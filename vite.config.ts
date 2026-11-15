import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  plugins: [
    react(),
    {
      name: 'preserve-original-lab',
      configureServer(server) {
        server.middlewares.use('/legacy', (_request, response) => {
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(
            readFileSync(new URL('./v1-1d-diagnostics/idp_master_final.html', import.meta.url)),
          );
        });
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'legacy/index.html',
          source: readFileSync(
            new URL('./v1-1d-diagnostics/idp_master_final.html', import.meta.url),
            'utf8',
          ),
        });
      },
    },
  ],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
