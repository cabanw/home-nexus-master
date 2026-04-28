import { defineConfig, Plugin } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { exec } from "child_process";
import { parseString } from "xml2js";
import { IncomingMessage, ServerResponse } from "http";
import { parseNmapHosts } from "./src/utils/nmapParser";

// Vite plugin to create a custom API endpoint for network scanning
function networkScanApiPlugin(): Plugin {
  return {
    name: 'network-scan-api',
    configureServer(server) {
      server.middlewares.use('/api/scan', (req: IncomingMessage, res: ServerResponse) => {
        const subnet = process.env.SCAN_SUBNET ?? '192.168.1.0/24';
        exec(`./nmap -oX - ${subnet}`, { timeout: 30000 }, (error, stdout, stderr) => {
          if (error) {
            console.error(`nmap exec error: ${error.message}`);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: 'Failed to run network scan.', error: error.message }));
            return;
          }
          if (stderr) {
            console.warn(`nmap stderr: ${stderr}`);
          }

          parseString(stdout, (err, result) => {
            if (err) {
              console.error(`xml2js parse error: ${err}`);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'Failed to parse scan results.', error: err.message }));
              return;
            }

            try {
              const devices = parseNmapHosts(result);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(devices));
            } catch (processingError: any) {
              console.error(`Error processing scan results: ${processingError}`);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'Failed to process scan results.', error: processingError.message }));
            }
          });
        });
      });
    },
  };
}


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    networkScanApiPlugin()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    deps: {
      inline: [/class-variance-authority/],
    },
  },
}));
