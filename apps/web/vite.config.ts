import path from 'node:path';
import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  html: {
    cspNonce: 'softbook-web',
  },
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    fs: {allow: [path.resolve(import.meta.dirname, '../..')]},
    port: 4173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
