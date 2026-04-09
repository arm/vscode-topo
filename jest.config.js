module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "\\.(css|less)$": "identity-obj-proxy"
  },
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest"
  },
  roots: [
    "<rootDir>/src",
    "<rootDir>/media"
  ],
  testMatch: [
    "**/?(*.)+(test).[jt]s?(x)"
  ],
  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}", "!src/**/*.d.ts"],
  setupFilesAfterEnv: [
    "<rootDir>/jest.setup.ts"
  ],
};
