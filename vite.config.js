import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualEditPlugin } from './vite-plugins/visual-edit-plugin.js'
import { errorOverlayPlugin } from './vite-plugins/error-overlay-plugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    // Required for Capacitor — absolute /assets/ paths cause a white screen in the WebView.
    base: './',
    define: {
      __RESTOREBRAINE_NATIVE_LOCAL__: JSON.stringify(process.env.NATIVE_LOCAL === '1'),
    },
    plugins: [
      mode === 'development' && visualEditPlugin(),
      react(),
      errorOverlayPlugin(),
      {
        name: 'capacitor-strip-crossorigin',
        apply: 'build',
        transformIndexHtml(html) {
          let out = html.replace(/\s+crossorigin(?:="[^"]*")?/g, '');
          // Bundled capacitor:// does not need hosted-only redirect scripts (can block boot)
          if (process.env.NATIVE_LOCAL === '1') {
            return out
              .replace(/<script src="\.\/native-oauth-return\.js"><\/script>\s*/g, '')
              .replace(/<script src="\.\/login-redirect\.js"><\/script>\s*/g, '');
          }
          return out;
        },
      },
      {
        name: 'iframe-hmr',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            // Allow iframe embedding
            res.setHeader('X-Frame-Options', 'ALLOWALL');
            res.setHeader('Content-Security-Policy', "frame-ancestors *;");
            next();
          });
        }
      }
    ].filter(Boolean),
    server: {
      host: '0.0.0.0', // Bind to all interfaces for container access
      port: 5173,
      strictPort: true,
      // Allow all hosts - essential for Modal tunnel URLs
      allowedHosts: true,
      watch: {
        // Enable polling for better file change detection in containers
        usePolling: true,
        interval: 100, // Check every 100ms for responsive HMR
      },
      hmr: {
        protocol: 'wss',
        clientPort: 443
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    }
  }
});