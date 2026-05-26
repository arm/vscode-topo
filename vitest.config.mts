import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    resolve: {
        alias: {
            vscode: path.resolve(__dirname, 'src/__mocks__/vscode.js'),
        },
    },
    test: {
        environment: 'node',
        globals: true,
        include: ['src/**/*.test.ts'],
        passWithNoTests: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{js,ts}'],
            exclude: ['src/**/*.d.ts', 'src/util/test/**'],
        },
    },
});
