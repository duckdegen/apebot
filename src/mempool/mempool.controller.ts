import { createAlchemyWeb3 } from "@alch/alchemy-web3";
import { BigNumber } from "@0x/utils";
import dotenv from "dotenv";
dotenv.config();

const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL;
// const PURCHASING_GAS_MULTIPLIER = +process.env.PURCHASING_GAS_MULTIPLIER || 5;
const maxPriorityPerGasFromConfig = process.env.MAX_PRIORITY_FEE_PER_GAS;

const web3 = createAlchemyWeb3(ALCHEMY_API_URL);

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

// export const getFees = async (): Promise<fees> => {
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     const web3alchemy = web3.eth as any;
//     return Promise.all([web3.eth.getBlock("pending"), web3alchemy.getMaxPriorityFeePerGas()]).then(
//         ([block, maxPriorityFeePerGasHex]) => {
//             // eslint-disable-next-line @typescript-eslint/no-explicit-any
//             const baseFeePerGas = new BigNumber((<any>block).baseFeePerGas);

//             // Multiply priorityfee by multiplier to make it more attractive to miners.
//             const maxPriorityFeePerGas = new BigNumber(maxPriorityFeePerGasHex).times(
//                 new BigNumber(PURCHASING_GAS_MULTIPLIER)
//             );
//             const maxFeePerGas = new BigNumber(baseFeePerGas.plus(maxPriorityFeePerGas));
//             return {
//                 maxPriorityFeePerGas,
//                 maxFeePerGas,
//             };
//         }
//     );
// };

// Retrieve highest gas price for currently pending block
// Offer 10% higher than that
// Check if the offer is not rekting us. if it is, abort. We should assume a standard 30% gain from these pumps.
// export const streamTransactions = asyc (): Promise<unknown> => {
//     web3.eth.subscribe("alchemy_fullPendingTransactions")
// }
