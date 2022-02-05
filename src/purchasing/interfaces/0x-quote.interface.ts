export interface QuoteFrom0x {
    price: string;
    guaranteedPrice: string;
    to: string;
    data: string;
    value: string;
    gas: string;
    estimatedGas: string;
    gasPrice: string;
    protocolFee: string;
    minimumProtocolFee: string;
    buyTokenAddress: string;
    sellTokenAddress: string;
    buyAmount: string;
    sellAmount: string;
    sources: Source[];
    orders: Order[];
    allowanceTarget: string;
    sellTokenToEthRate: string;
    buyTokenToEthRate: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    type: number;
}

interface Order {
    makerToken: string;
    takerToken: string;
    makerAmount: string;
    takerAmount: string;
    fillData: FillData;
    source: string;
    sourcePathId: string;
    type: number;
}

interface FillData {
    tokenAddressPath: string[];
    router: string;
}

interface Source {
    name: string;
    proportion: string;
}
