import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load environment variables with VITE_ prefix
    const env = loadEnv(mode, '.', 'VITE_');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'exclude-api-routes',
          resolveId(id) {
            if (id.includes('/api/') || id.includes('\\api\\')) {
              return { id, external: true };
            }
          }
        }
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        exclude: ['@prisma/client', '.prisma', '@prisma/adapter-neon', '@neondatabase/serverless']
      },
      build: {
        rollupOptions: {
          external: ['@prisma/client', '.prisma/client', '@prisma/adapter-neon', '@neondatabase/serverless'],
          output: {
            manualChunks: {
              'vendor': ['react', 'react-dom']
            }
          }
        }
      }
    };
});
