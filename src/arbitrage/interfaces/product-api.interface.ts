export interface productData {
    s: string;
    st: string;
    b: string;
    q: string;
    ba: string;
    qa: string;
    i: string;
    ts: string;
    an: string;
    qn: string;
    o: string;
    h: string;
    l: string;
    c: string;
    v: string;
    qv: string;
    y: number;
    as: number;
    pm: string;
    pn: string;
    cs: number;
    tags: string[];
    pom: boolean;
    pomt?: unknown;
    planToOpenMarketTime?: unknown;
    etf: boolean;
}

export interface ProductBySymbolApiData {
    code: string;
    message?: unknown;
    messageDetail?: unknown;
    data: productData;
    success: boolean;
}
