export const buildQueryParams = (obj: { [s: string]: unknown } | ArrayLike<unknown>): string => {
    return Object.entries(obj)
        .map((pair) => pair.map(encodeURIComponent).join("="))
        .join("&");
};
