import { BigNumber } from "@0x/utils";

export const toHex = (inputNumber: number | BigNumber): string => {
    return inputNumber.toString(16);
};
