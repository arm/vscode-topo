// vite.config.mjs
import { BuildEnvironmentOptions, ConfigEnv, defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig((config: ConfigEnv) => {
    const isDev = process.argv.includes('--watch');
    console.log(
        `Vite is running in ${isDev ? 'development' : 'production'} mode`,
    );
    console.log(`Build config:\n${JSON.stringify(config, null, 2)}`);
    const build: BuildEnvironmentOptions = {
        minify: isDev ? false : 'oxc',
        emptyOutDir: false,
        target: 'node22',
        outDir: 'dist',
        sourcemap: isDev ? 'inline' : false,
        lib: {
            entry: path.resolve(__dirname, 'src/extension.ts'),
            formats: ['cjs'],
            fileName: () => 'extension.js',
        },
        rolldownOptions: {
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
        build,
    };
});
