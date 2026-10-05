/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` plus a hash router lets the same build run from any folder,
// including a GitHub Pages project site (https://<owner>.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
