import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  return {
    plugins: [react()],
    base: command === 'build' ? '/app/' : '/',
    build: {
      outDir: '../static/app',
      emptyDirBeforeWrite: true,
    },
    server: {
      port: 5173,
      proxy: {
        '/nse_data': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/auth': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/holdings': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/profile': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/portfolio': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
