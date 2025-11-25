// vite.config.mjs
import { BuildEnvironmentOptions, ConfigEnv, defineConfig, UserConfigExport } from 'vite';
import tsconfigPaths    from 'vite-tsconfig-paths';
import react            from '@vitejs/plugin-react';
import copy             from 'rollup-plugin-copy';
import path             from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export default defineConfig((config: ConfigEnv) => {
  console.log(config)
  const { mode } = config;
  const isDev = process.argv.includes('--watch');
  console.log(`Vite is running in ${isDev ? 'development' : 'production'} mode`);
  // ------------------------
  // 1) Extension Host Build
  // ------------------------
  if (mode === 'extension') {
    const build: BuildEnvironmentOptions = {
      minify: isDev ? false : 'esbuild',
      emptyOutDir: false,
      target:    'node16',
      outDir:    'dist',
      sourcemap: 'inline',
      lib: {
        entry:     path.resolve(__dirname, 'src/extension.ts'),
        formats:   ['cjs'],
        fileName:  () => 'extension.js'
      },
      rollupOptions: {
        external: [
          'vscode',
          'fs',
          'path',
          'child_process',
          'util',
          'net'
        ],
        output: {
          exports: 'named'
        }
      }
    };
    return {
      plugins: [
        tsconfigPaths()
      ],
      build
    };
  }

  const build: BuildEnvironmentOptions = {
    minify: isDev ? false : 'esbuild',
    emptyOutDir: false,
    target: 'esnext',
    outDir: 'dist',
    sourcemap: 'inline',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'media/main.tsx')
      },
      output: {
        entryFileNames: 'main.js'
      },
    },
  };
  // ------------------------
  // 2) Webview Build
  // ------------------------
  // (mode === 'webview' or default)
  return {
    plugins: [
      tsconfigPaths(),
      react(),
      copy({
        targets: [ { src: 'media/main.css', dest: 'dist' } ],
        hook:    'writeBundle'
      })
    ],
    build
  };
});
