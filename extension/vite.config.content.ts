import { defineConfig } from 'vite';
import path from 'path';

// Separate config for content script - builds as IIFE with everything inlined
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/content/index.ts'),
      name: 'ContentScript',
      formats: ['iife'],
      fileName: () => 'content/index.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

