import path from 'path';
import fs from 'fs';
import net from 'net';
import { spawn, execSync, type ChildProcess } from 'child_process';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

function ensureApiServerPlugin(): Plugin {
  let apiChild: ChildProcess | null = null;

  const isPortOpen = (targetPort: number): Promise<boolean> =>
    new Promise((resolve) => {
      const socket = net.createConnection({ port: targetPort, host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
    });

  return {
    name: 'fileit-api-server-boot',
    apply: 'serve',
    configureServer(server) {
      const apiServerDir = path.resolve(import.meta.dirname, '..', 'api-server');
      const distEntry = path.join(apiServerDir, 'dist', 'index.mjs');

      // Short delay so external launchers (like dev.sh) can bind 3001 first if running concurrently
      const bootTimer = setTimeout(async () => {
        const alreadyListening = await isPortOpen(3001);
        if (alreadyListening) return;

        if (!fs.existsSync(distEntry)) {
          try {
            execSync('node ./build.mjs', { cwd: apiServerDir, stdio: 'inherit' });
          } catch (err) {
            console.error('[fileit-api-server] Failed to build api-server:', err);
            return;
          }
        }

        apiChild = spawn(process.execPath, ['--enable-source-maps', distEntry], {
          cwd: apiServerDir,
          env: { ...process.env, PORT: '3001', NODE_ENV: 'development' },
          stdio: 'inherit',
        });

        apiChild.on('error', (err) => {
          console.error('[fileit-api-server] Failed to start:', err);
        });
      }, 4500);

      const cleanup = () => {
        clearTimeout(bootTimer);
        if (apiChild && !apiChild.killed) {
          apiChild.kill('SIGTERM');
          apiChild = null;
        }
      };

      server.httpServer?.once('close', cleanup);
      process.once('exit', cleanup);
    },
  };
}

const port = Number(process.env.PORT || 3000);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value`);
}

const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ensureApiServerPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
