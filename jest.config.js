const commonConfig = {
  moduleNameMapper: {
    "\\.(css|less)$": "identity-obj-proxy"
  },
  transform: {
    "^.+\\.(ts|tsx)$": ["@swc/jest", {
      jsc: {
        parser: { syntax: "typescript", tsx: true },
        transform: { react: { runtime: "automatic" } }
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
    },
    {
      ...commonConfig,
      displayName: "ui",
      testEnvironment: "jsdom",
      roots: ["<rootDir>/media"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    }
  ],
};
