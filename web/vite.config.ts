import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** True when the resolved module belongs to one of the listed npm packages. */
function isPackage(id: string, names: string[]): boolean {
  return names.some(
    (name) =>
      id.includes(`/node_modules/${name}/`) ||
      id.includes(`/node_modules/${name}\\`) ||
      id.includes(`/node_modules/.pnpm/${name}@`),
  );
}

export default defineConfig({
  plugins: [tailwindcss(), react()],
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

          if (isPackage(id, ['leaflet', 'react-leaflet', '@react-leaflet/core'])) {
            return 'map-vendor';
          }

          // Keep React core + router + scheduler together. A naive
          // id.includes('react') split left `scheduler` in `vendor` and created
          // vendor <-> react-vendor cycles (WSOD: Cannot access before init).
          if (
            isPackage(id, [
              'react',
              'react-dom',
              'react-router',
              'react-router-dom',
              'scheduler',
              'use-sync-external-store',
            ])
          ) {
            return 'react-vendor';
          }

          if (id.includes('@supabase')) return 'supabase-vendor';
          return 'vendor';
        },
      },
    },
  },
});
