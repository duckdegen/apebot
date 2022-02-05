import { TransactionReceipt } from "web3-core/types";
import dotenv from "dotenv";
dotenv.config();
// import { Hex } from "web3-utils/types";
// import { fromWei, hexToNumber, toHex, toBN, toWei } from "web3-utils";
import { QuoteFrom0x } from "./interfaces/0x-quote.interface";
import { BigNumber, fromTokenUnitAmount, toTokenUnitAmount } from "@0x/utils";

import {
    findBuyableTokens,
    markBuyableTokensAsPurchased,
    markBuyableTokensInProcessing,
} from "../coin-analysis/coin-analysis.service";
import { calculateSpendableAmount } from "../riskmanagement/riskmanagement.controller";
import { getWalletBalanceInWei, executeSwapOn0x } from "../wallet/wallet.controller";
import { getQuoteForToken } from "./purchasing.service";
import { Logger } from "tslog";
import { LeanDocument } from "mongoose";
import { TokenDetails } from "../coin-analysis/schemas/token-details.schema";
import { createAlchemyWeb3 } from "@alch/alchemy-web3";
import twilio from "twilio";
const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const maxPriorityPerGasFromConfig = process.env.MAX_PRIORITY_FEE_PER_GAS;

const client = twilio(accountSid, authToken);

const web3 = createAlchemyWeb3(ALCHEMY_API_URL);

const log: Logger = new Logger();
const { MY_ETHEREUM_ADDRESS } = process.env;
// const PURCHASING_GAS_MULTIPLIER = +process.env.PURCHASING_GAS_MULTIPLIER || 5;

export const buyAllTheTokens = async (): Promise<(LeanDocument<TokenDetails> | void)[]> => {
    const buyableTokens = await findBuyableTokens();

    return Promise.all(
        buyableTokens.map(async (buyableToken) => {
            if (buyableToken.buyLock) {
                return;
            }
            const { maxFeePerGas, maxPriorityFeePerGas } = await getFees();
            await markBuyableTokensInProcessing(buyableToken.tokenCode);
            const walletBalanceInWei = await getWalletBalanceInWei();
            const quotePayload = await assembleQuoteRequestPayload(buyableToken.tokenContract, walletBalanceInWei);
            let quoteForPurchase = {} as QuoteFrom0x;
            const { tradeAmountInWei } = quotePayload;

            try {
                quoteForPurchase = await getQuoteForToken(quotePayload);
            } catch (error) {
                log.debug(quoteForPurchase);
                log.error(error);
                return Promise.resolve();
            }
            log.debug(`${buyableToken.tokenCode}: Quoted obtained from 0x: ${JSON.stringify(quoteForPurchase)}`);

            // Inject EIP-1559 data into tx
            quoteForPurchase.maxFeePerGas = maxFeePerGas.integerValue(BigNumber.ROUND_CEIL).toString();
            quoteForPurchase.maxPriorityFeePerGas = maxPriorityFeePerGas.integerValue(BigNumber.ROUND_CEIL).toString();
            quoteForPurchase.type = 2;
            delete quoteForPurchase.gasPrice;

            const quotedPriceInWei = fromTokenUnitAmount(
                new BigNumber(1).dividedBy(new BigNumber(quoteForPurchase.guaranteedPrice))
            );

            log.debug(
                `$${buyableToken.tokenCode}: Current wallet balance: ${toTokenUnitAmount(walletBalanceInWei).toFixed(
                    6
                )}Ξ, riskmanaged spendable: ${toTokenUnitAmount(tradeAmountInWei).toFixed(
                    6
                )}Ξ, max fee per gas: ${maxFeePerGas.dividedBy(
                    1000000000
                )}, priority fee for miner: ${maxPriorityFeePerGas.dividedBy(1000000000)}`
            );

            log.debug(
                `$${buyableToken.tokenCode}: Quoted for ${quotedPriceInWei}. Exected output should be ${tradeAmountInWei
                    .dividedBy(quotedPriceInWei)
                    .toFixed(6)}`
            );

            log.info(`$${buyableToken.tokenCode}: Proceeding to purchase token`);
            try {
                const receipt = await executeSwapOn0x(quoteForPurchase);
                log.info(JSON.stringify(receipt));
                if (receipt.status === true) {
                    notifyHumans(receipt, buyableToken);
                    return markBuyableTokensAsPurchased(buyableToken.tokenCode);
                }
            } catch (error) {
                notifyAdmin(buyableToken);
                log.error(error);
            }
        })
    );
};

export const notifyAdmin = async (buyableToken: LeanDocument<TokenDetails> | { tokenCode: string }): Promise<void> => {
    log.info("Notifying admins via twilio");
    client.calls
        .create({
            url: "https://handler.twilio.com/twiml/****",
            to: "****",
            from: "***",
        })
        .then((call) => log.debug(call.sid));

    client.messages
        .create({
            body: `Failed to purchase ${buyableToken.tokenCode}.`,
            from: "****",
            to: "****",
        })
        .then((message) => log.debug(message.sid));
};

export const notifyHumans = async (
    txreceipt: TransactionReceipt | { transactionHash: string },
    buyableToken: LeanDocument<TokenDetails> | { tokenCode: string }
): Promise<void> => {
    log.info("Notifying admins via twilio");
    client.calls
        .create({
            url: "https://handler.twilio.com/twiml/****",
            to: "****",
            from: "***",
        })
        .then((call) => log.debug(call.sid));

    client.messages
        .create({
            body: `Aped into ${buyableToken.tokenCode}. Tx: https://dashboard.tenderly.co/tx/main/${txreceipt.transactionHash}`,
            from: "****",
            to: "****",
        })
        .then((message) => log.debug(message.sid));
};

interface fees {
    maxPriorityFeePerGas: BigNumber;
    maxFeePerGas: BigNumber;
}

export const getFees = async (): Promise<fees> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Promise.all([web3.eth.getBlock("pending")]).then(([block]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const baseFeePerGas = new BigNumber((<any>block).baseFeePerGas);

        // Multiply priorityfee by multiplier to make it more attractive to miners.
        const maxPriorityFeePerGas = new BigNumber(maxPriorityPerGasFromConfig);
        const maxFeePerGas = new BigNumber(baseFeePerGas.plus(maxPriorityFeePerGas));
        return {
            maxPriorityFeePerGas,
            maxFeePerGas,
        };
    });
};

const assembleQuoteRequestPayload = async (
    tokenContract: string,
    walletBalanceInWei: BigNumber
): Promise<{
    targetToken: string;
    tradeAmountInWei: BigNumber;
    takerAddress: string;
}> => {
    const tradeAmountInWei = calculateSpendableAmount(walletBalanceInWei);

    if (!walletBalanceInWei || !tradeAmountInWei) {
        throw new Error("Not enough data to generate quote request payload");
    }

    return {
        targetToken: tokenContract,
        tradeAmountInWei: new BigNumber(tradeAmountInWei.toFixed(0)),
        takerAddress: MY_ETHEREUM_ADDRESS,
    };
};
