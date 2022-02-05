import { QuoteFrom0x } from "../purchasing/interfaces/0x-quote.interface";

import dotenv from "dotenv";
dotenv.config();
import { BigNumber } from "@0x/utils";

import {
    getBalance,
    getERC20Balance,
    computeERC20TransactionData,
    sendAllErc20TokensDTO,
    sendSignedTransaction,
    signTransaction,
} from "./wallet.service";
const { PRIVATE_KEY, MY_ETHEREUM_ADDRESS } = process.env;
import type { TransactionReceipt } from "web3-core/types";

export const getWalletBalanceInWei = async (): Promise<BigNumber> => {
    const balanceInWei = await getBalance(MY_ETHEREUM_ADDRESS);
    console.warn("balanceInWei");
    console.warn(balanceInWei);
    const numbericalBalance = new BigNumber(balanceInWei);
    return numbericalBalance;
};

export const getWalletBalanceForERC20Token = async (tokenContract: string): Promise<BigNumber> => {
    const balance = await getERC20Balance({ tokenContract, walletAddress: MY_ETHEREUM_ADDRESS });

    const numbericalBalance = new BigNumber(balance);
    return numbericalBalance;
};

export const executeSwapOn0x = async (quote: QuoteFrom0x): Promise<TransactionReceipt> => {
    const signedTransaction = await signTransaction(quote, PRIVATE_KEY);
    return sendSignedTransaction(signedTransaction);
};

export const sendErc20Tokens = async (dto: sendAllErc20TokensDTO): Promise<TransactionReceipt> => {
    const { tokenContract, walletAddress, recipientAddress, gasPrice } = dto;
    const transactionData = await computeERC20TransactionData({
        tokenContract,
        walletAddress,
        recipientAddress,
        gasPrice,
    });
    const signedTransaction = await signTransaction(transactionData, PRIVATE_KEY);
    return sendSignedTransaction(signedTransaction);
};
