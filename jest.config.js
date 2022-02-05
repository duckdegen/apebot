module.exports = {
    testEnvironment: "node",
    rootDir: "./",
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: "coverage",
    collectCoverageFrom: ["src/**/*.ts"],
    setupFiles: ["./scripts/jest-setup.ts"],
    modulePathIgnorePatterns: ["<rootDir>/lib"],
    verbose: true,
    moduleNameMapper: {},
    coveragePathIgnorePatterns: [],
    transform: {
        "^.+\\.ts?$": "ts-jest",
    },
    testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    globals: {
        "ts-jest": {
            tsconfig: "<rootDir>/tsconfig.jest.json",
            compiler: "ttypescript",
        },
    },
};
