import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'public/manifest.json',
          dest: '.',
        },
        {
          src: 'public/icons/*',
          dest: 'icons',
        },
        {
          src: 'public/wasm/*',
          dest: 'wasm',
        },
        {
          src: 'public/logs.html',
          dest: '.',
        },
        {
          src: 'public/logs.js',
          dest: '.',
        },
        {
          src: 'public/simple-logs.html',
          dest: '.',
        },
      ],
    }),
    // Move HTML files to correct locations after build
    {
      name: 'move-html-files',
      closeBundle() {
        const distDir = path.resolve(__dirname, 'dist');
        
        // Move popup HTML
        const popupSrc = path.join(distDir, 'src/popup/index.html');
        const popupDest = path.join(distDir, 'popup/index.html');
        if (fs.existsSync(popupSrc)) {
          fs.mkdirSync(path.dirname(popupDest), { recursive: true });
          fs.copyFileSync(popupSrc, popupDest);
        }
        
        // Move offscreen HTML
        const offscreenSrc = path.join(distDir, 'src/offscreen/index.html');
        const offscreenDest = path.join(distDir, 'offscreen/index.html');
        if (fs.existsSync(offscreenSrc)) {
          fs.mkdirSync(path.dirname(offscreenDest), { recursive: true });
          fs.copyFileSync(offscreenSrc, offscreenDest);
        }
        
        // Clean up src directory
        const srcDir = path.join(distDir, 'src');
        if (fs.existsSync(srcDir)) {
          fs.rmSync(srcDir, { recursive: true, force: true });
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'src/popup/index.html'),
        background: path.resolve(__dirname, 'src/background/index.ts'),
        // content script built separately with vite.config.content.ts
        offscreen: path.resolve(__dirname, 'src/offscreen/index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Place each entry point in its own directory
          const name = chunkInfo.name;
          if (name === 'background') return 'background/index.js';
          if (name === 'content') return 'content/index.js';
          if (name === 'offscreen') return 'offscreen/index.js';
          if (name === 'popup') return 'popup/popup.js';
          return '[name]/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Place HTML files in their respective directories
          if (assetInfo.name?.endsWith('.html')) {
            if (assetInfo.name.includes('popup')) return 'popup/index.html';
            if (assetInfo.name.includes('offscreen')) return 'offscreen/index.html';
          }
          // CSS and other assets
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        format: 'es',
        // Inline everything for content script to avoid import issues
        manualChunks: (id) => {
          // Don't create separate chunks for content script dependencies
          if (id.includes('src/content')) {
            return undefined;
          }
        },
      },
    },
    // Disable code splitting for better compatibility
    modulePreload: false,
  },
});

