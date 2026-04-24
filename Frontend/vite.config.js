import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Wrap your config in defineConfig
export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    build: {
      sourcemap: mode === 'development',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            axios: ['axios'],
            pdf: ['jspdf', 'jspdf-autotable'],
            excel: ['exceljs', 'file-saver'],
          },
        },
      },
    },
  };
});