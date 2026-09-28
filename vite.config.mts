// vite.config.mjs
import { BuildEnvironmentOptions, ConfigEnv, defineConfig } from 'vite';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig((config: ConfigEnv) => {
    const isDev = process.argv.includes('--watch');
    const connectionString =
        process.env.AZURE_ANALYTICS_CONNECTION_STRING?.trim() ?? '';
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
            external: (id) => id === 'vscode' || isBuiltin(id),
            output: {
                exports: 'named',
            },
        },
    };
    return {
        build,
        define: {
            __TELEMETRY_CONNECTION_STRING__: JSON.stringify(connectionString),
        },
        resolve: {
            mainFields: ['module', 'main'],
            conditions: ['node'],
        },
    };
});
