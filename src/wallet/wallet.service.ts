import { BigNumber } from "@0x/utils";

import dotenv from "dotenv";
dotenv.config();
import { createAlchemyWeb3 } from "@alch/alchemy-web3";
import type { Contract } from "web3-eth-contract";
import got from "got";
// import sound from "sound-play";

import type { SignedTransaction, TransactionConfig, TransactionReceipt } from "web3-core/types";
import type { AbiItem } from "web3-utils/types";
import { toHex } from "../utils";
import { Logger } from "tslog";

const log: Logger = new Logger();
const { ALCHEMY_API_URL, ETHERSCAN_API_KEY } = process.env;
const web3 = createAlchemyWeb3(ALCHEMY_API_URL);

export const getNonce = async (myAddress: string): Promise<number> => {
    return web3.eth.getTransactionCount(myAddress, "latest"); // nonce starts counting from 0
};

export const signTransaction = async (
    transaction: TransactionConfig,
    privateKey: string
): Promise<SignedTransaction> => {
    return web3.eth.accounts.signTransaction(transaction, privateKey);
};

export const getBalance = async (walletAddress: string): Promise<string> => {
    return web3.eth.getBalance(walletAddress);
};

export type txDataDTO = {
    recipientAddress: string;
    txAmountWei: string;
    gasPrice: string;
    nonce: number;
    privateKey: string;
};

export const sendEth = async (dto: txDataDTO): Promise<TransactionReceipt> => {
    const transactionData = {
        to: dto.recipientAddress,
        value: dto.txAmountWei,
        maxPriorityFeePerGas: dto.gasPrice,
        nonce: dto.nonce,
    };

    const signedTransaction = await signTransaction(transactionData, dto.privateKey);
    const sentTx = await sendSignedTransaction(signedTransaction);
    return sentTx;
};

const getContractABI = async (tokenAddress: string): Promise<AbiItem[]> => {
    console.log("fetching ABI from etherscan");
    const payload = await got
        .get("https://api.etherscan.io/api", {
            searchParams: {
                module: "contract",
                action: "getabi",
                address: tokenAddress,
                apikey: ETHERSCAN_API_KEY,
            },
        })
        .json<{
            status: string;
            message: string;
            result: string;
        }>();

    if (payload && payload.result) {
        return JSON.parse(payload.result) as AbiItem[];
    } else {
        console.debug("abi retreiving failed. pleaese inspect payload below:");
    }
    console.debug(JSON.stringify(payload));

    return Promise.reject("ABI not valid");
};

interface getContractForTokenDTO {
    tokenContract: string;
    walletAddress: string;
}
const getContractForToken = async (dto: getContractForTokenDTO): Promise<Contract> => {
    const { tokenContract, walletAddress } = dto;
    const tokenAbiList = await getContractABI(tokenContract);
    if (!tokenAbiList) {
        return Promise.reject("No ABI could be retrieved");
    }
    const contract = new web3.eth.Contract(tokenAbiList, tokenContract, { from: walletAddress });
    return contract;
};

export interface getErcDTO {
    tokenContract: string;
    walletAddress: string;
    erc20Contract?: Contract;
}
export const getERC20Balance = async (dto: getErcDTO): Promise<string> => {
    const { tokenContract, walletAddress } = dto;
    let { erc20Contract } = dto;
    if (!erc20Contract) {
        erc20Contract = await getContractForToken({ tokenContract, walletAddress });
    }
    log.debug(`ERC20 contract: ${erc20Contract}`);
    const tokenBalance = await erc20Contract.methods.balanceOf(walletAddress).call();
    return tokenBalance;
};

export interface sendAllErc20TokensDTO {
    tokenContract: string;
    walletAddress: string;
    recipientAddress: string;
    gasPrice: BigNumber;
}
export const computeERC20TransactionData = async (dto: sendAllErc20TokensDTO): Promise<TransactionConfig> => {
    const { tokenContract, walletAddress, recipientAddress, gasPrice } = dto;
    const erc20Contract = await getContractForToken({ tokenContract, walletAddress });
    const balanceInWei = await getERC20Balance({ tokenContract, walletAddress, erc20Contract });
    const roundedBalanceInWei = balanceInWei.slice(0, -16) + "0000000000000000";

    const gasEstimate = await erc20Contract.methods.transfer(recipientAddress, roundedBalanceInWei).estimateGas();
    const nonce = await getNonce(walletAddress);
    const data = await erc20Contract.methods.transfer(recipientAddress, roundedBalanceInWei).encodeABI();

    const rawTransaction = {
        from: walletAddress,
        nonce: nonce,
        gasPrice: "0x" + toHex(gasPrice),
        gasLimit: "0x" + toHex(gasEstimate),
        to: tokenContract,
        value: 0,
        data: data,
        chainId: 1,
    };

    return rawTransaction;
};

export const sendSignedTransaction = async (signedTx: SignedTransaction): Promise<TransactionReceipt> => {
    // sound.play("./src/alarm.mp3");
    // return Promise.resolve({ status: true } as TransactionReceipt);

    return web3.eth.sendSignedTransaction(signedTx.rawTransaction, function (error, hash) {
        if (!error) {
            log.info(
                "🎉 The hash of your transaction is: ",
                hash,
                "\n Check Alchemy's Mempool to view the status of your transaction!"
            );
        } else {
            log.error("❗Something went wrong while submitting your transaction:", error);
        }
    });
};
