/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import ViteComponents from 'unplugin-vue-components/vite';
import visualizer from 'rollup-plugin-visualizer';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import { FileSystemIconLoader } from 'unplugin-icons/loaders';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import AutoImport from 'unplugin-auto-import/vite';

export default defineConfig({
  define: {
    'process.env': process.env
  },
  build: {
    sourcemap: true
  },
  plugins: [
    vue({ reactivityTransform: true }),
    AutoImport({
      dts: true,
      imports: ['vue', 'vue-router'],
      dirs: ['./src/composables'],
      eslintrc: {
        enabled: true
      }
    }),
    ViteComponents({
      directoryAsNamespace: true,
      resolvers: [
        IconsResolver({
          customCollections: ['s'],
          alias: {
            ho: 'heroicons-outline'
          }
        }),
        componentName => {
          if (componentName.startsWith('Tune'))
            return { name: componentName, from: '@snapshot-labs/tune' };
        }
      ]
    }),
    visualizer({
      filename: './dist/stats.html',
      template: 'sunburst',
      gzipSize: true
    }),
    Icons({
      compiler: 'vue3',
      customCollections: {
        // key as the collection name
        s: FileSystemIconLoader('./src/assets/icons', svg =>
          svg.replace(/^<svg /, '<svg fill="currentColor" ')
        )
      }
    }),
    // Put the Sentry vite plugin after all other plugins
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: 'snapshot',
      authToken: process.env.SENTRY_AUTH_TOKEN
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'happy-dom',
    coverage: {
      all: true
    },
    deps: {
      inline: ['@pusher/push-notifications-web']
    }
  }
});
