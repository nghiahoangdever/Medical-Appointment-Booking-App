import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The SPA calls relative /api/... URLs; in dev they are forwarded to the Express server.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
