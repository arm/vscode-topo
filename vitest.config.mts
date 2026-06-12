import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
        passWithNoTests: true,
        setupFiles: ['./vitest.setup.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{js,ts}'],
            exclude: ['src/**/*.d.ts', 'src/util/test/**'],
        },
    },
});
