// vite.config.mjs
import { BuildEnvironmentOptions, ConfigEnv, defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';
import copy from 'rollup-plugin-copy';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig((config: ConfigEnv) => {
    const { mode } = config;
    const isDev = process.argv.includes('--watch');
    console.log(
        `Vite is running in ${isDev ? 'development' : 'production'} mode`,
    );
    console.log(`Build config:\n${JSON.stringify(config, null, 2)}`);
    // ------------------------
    // 1) Extension Host Build
    // ------------------------
    if (mode === 'extension') {
        const build: BuildEnvironmentOptions = {
            minify: isDev ? false : 'esbuild',
            emptyOutDir: false,
            target: 'node16',
            outDir: 'dist',
            sourcemap: isDev ? 'inline' : false,
            lib: {
                entry: path.resolve(__dirname, 'src/extension.ts'),
                formats: ['cjs'],
                fileName: () => 'extension.js',
            },
            rollupOptions: {
                external: [
                    'vscode',
                    'node:fs',
                    'node:os',
                    'node:path',
                    'node:child_process',
                    'node:util',
                    'node:net',
                ],
                output: {
                    exports: 'named',
                },
            },
        };
        return {
            plugins: [
                tsconfigPaths({
                    projects: [path.resolve(__dirname, 'tsconfig.json')],
                }),
            ],
            build,
        };
    }

    const build: BuildEnvironmentOptions = {
        minify: isDev ? false : 'esbuild',
        emptyOutDir: false,
        target: 'esnext',
        outDir: 'dist',
        sourcemap: isDev ? 'inline' : false,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'media/main.tsx'),
            },
            output: {
                entryFileNames: 'main.js',
            },
        },
    };
    // ------------------------
    // 2) Webview Build
    // ------------------------
    // (mode === 'webview' or default)
    return {
        plugins: [
            tsconfigPaths({
                projects: [path.resolve(__dirname, 'tsconfig.json')],
            }),
            react(),
            copy({
                targets: [{ src: 'media/main.css', dest: 'dist' }],
                hook: 'writeBundle',
            }),
        ],
        build,
    };
});
