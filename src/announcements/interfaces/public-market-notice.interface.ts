export interface PublicMarketNotice {
    child: PublicMarketChild[];
    hasBeenVisited: boolean;
}

export interface PublicMarketChild {
    node: "element" | "text";
    tag: string;
    text: string;
    hasBeenVisited: boolean;
}
