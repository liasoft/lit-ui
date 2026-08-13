import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Two modes:
 *   vite / vite build --mode demo  -> builds the demo application (default root)
 *   vite build --mode lib          -> builds the distributable component library
 */
/**
 * The component families, in dependency order. Each one is both a barrel in
 * `src/components/<family>/index.ts` and a `@liasoft/lit-ui/components/<family>`
 * entry point in the published package, so consumers can register a subset
 * instead of the whole kit.
 */
const FAMILIES = [
  'primitives',
  'layout',
  'feedback',
  'table',
  'form',
  'dashboard',
  'settings',
  'auth',
  'editors',
] as const;

export default defineConfig(({ mode }) => {
  const common = {
    resolve: {
      alias: {
        '@liasoft/lit-ui': resolve(__dirname, 'src/index.ts'),
        '@': resolve(__dirname, 'src'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          // bootstrap 5.3 still uses @import internally
          silenceDeprecations: ['import', 'global-builtin', 'color-functions'],
          quietDeps: true,
        },
      },
    },
  };

  if (mode === 'lib') {
    return {
      ...common,
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        cssCodeSplit: false,
        lib: {
          // The root barrel plus one entry per family. Rollup hoists whatever
          // two entries share into a common chunk, so an element is only ever
          // defined once no matter how many entries a consumer imports.
          entry: {
            'liasoft-lit-ui': resolve(__dirname, 'src/index.ts'),
            ...Object.fromEntries(
              FAMILIES.map((family) => [
                `components/${family}`,
                resolve(__dirname, `src/components/${family}/index.ts`),
              ])
            ),
          },
          formats: ['es' as const],
        },
        rollupOptions: {
          external: ['lit', /^lit\//, 'bootstrap', /^bootstrap\//, 'chart.js', /^chart\.js\//],
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: 'chunks/[name]-[hash].js',
          },
        },
      },
    };
  }

  return {
    ...common,
    root: resolve(__dirname, 'demo'),
    publicDir: resolve(__dirname, 'demo/public'),
    base: './',
    build: {
      outDir: resolve(__dirname, 'dist-demo'),
      emptyOutDir: true,
    },
    server: {
      port: 5180,
      open: false,
    },
  };
});
