const commonConfig = {
  transform: {
    "^.+\\.(ts|tsx)$": ["@swc/jest", {
      jsc: {
        parser: { syntax: "typescript", tsx: true }
      }
    }]
  },
  testMatch: [
    "**/?(*.)+(test).[jt]s?(x)"
  ],
};

module.exports = {
  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}", "!src/**/*.d.ts"],
  projects: [
    {
      ...commonConfig,
      displayName: "unit",
      testEnvironment: "node",
      roots: ["<rootDir>/src"],
    }
  ],
};
