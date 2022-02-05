export function compare(a: number, b: number): number {
    return a > b ? 1 : a < b ? -1 : 0;
}

export function add(a: number, b: number): number {
    return a + b;
}

export function sum(arr: number[]): number {
    return arr.reduce(add);
}

export function mean(arr: number[]): number {
    return sum(arr) / arr.length;
}

export function std(arr: number[]): number {
    return Math.sqrt(variance(arr));
}

export function variance(arr: number[]): number {
    if (arr.length < 2) return 0;

    const _mean = mean(arr);
    return arr.map((x) => Math.pow(x - _mean, 2)).reduce(add) / (arr.length - 1);
}

export function median(arr: number[]): number {
    if (arr.length < 2) return arr[0];

    const sorted = arr.slice().sort(compare);
    if (sorted.length % 2 === 0) {
        // even
        return (sorted[arr.length / 2 - 1] + sorted[arr.length / 2]) / 2;
    } else {
        // odd
        return sorted[(arr.length - 1) / 2];
    }
}
