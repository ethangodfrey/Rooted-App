import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            if (id.includes('/src/pages/admin/')) return 'admin-pages';
            if (id.includes('/src/pages/vendor/')) return 'vendor-pages';
            if (id.includes('/src/pages/shopper/')) return 'shopper-pages';
            if (id.includes('/src/pages/chef/')) return 'chef-pages';
            if (id.includes('/src/pages/marketing/') || id.includes('/src/pages/onboarding/')) {
              return 'public-pages';
            }
            return undefined;
          }
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'map-vendor';
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'react-vendor';
          }
          if (id.includes('@supabase')) return 'supabase-vendor';
          return 'vendor';
        },
      },
    },
  },
});
