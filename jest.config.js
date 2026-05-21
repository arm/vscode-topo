const commonConfig = {
  transform: {
    "^.+\\.ts$": ["@swc/jest", {
      jsc: {
        parser: { syntax: "typescript" }
      }
    }]
  },
  testMatch: [
    "**/?(*.)+(test).[jt]s"
  ],
};

module.exports = {
  collectCoverageFrom: [
    "src/**/*.{js,ts}",
    "!src/**/*.d.ts",
    "!src/util/test/**",
  ],
  projects: [
    {
      ...commonConfig,
      displayName: "unit",
      testEnvironment: "node",
      roots: ["<rootDir>/src"],
    }
  ],
};
