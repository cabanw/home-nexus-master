import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { exec } from "child_process";
import { parseString } from "xml2js";
import { IncomingMessage, ServerResponse } from "http";

// Vite plugin to create a custom API endpoint for network scanning
function networkScanApiPlugin(): Plugin {
  return {
    name: 'network-scan-api',
    configureServer(server) {
      server.middlewares.use('/api/scan', (req: IncomingMessage, res: ServerResponse) => {
        // Use the locally downloaded nmap binary
        exec('./nmap -oX - 192.168.1.0/24', { timeout: 30000 }, (error, stdout, stderr) => {
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
              // Defensive parsing of the nmap output
              const hosts = result?.nmaprun?.host || [];
              const devices = hosts.map((host: any) => {
                const ipv4 = host.address?.find((addr: any) => addr?.$?.addrtype === 'ipv4');
                const mac = host.address?.find((addr: any) => addr?.$?.addrtype === 'mac');
                const vendor = mac?.$?.vendor || null;

                let name = 'Unknown Device';
                if (host.hostnames?.[0] && host.hostnames[0].hostname?.[0]?.$?.name) {
                    name = host.hostnames[0].hostname[0].$.name;
                } else if (vendor) {
                    name = vendor;
                }
                
                return {
                  id: mac?.$?.addr || ipv4?.$?.addr || Math.random().toString(),
                  name: name,
                  ip: ipv4?.$?.addr || 'N/A',
                  mac: mac?.$?.addr || 'N/A',
                  type: 'unknown',
                  status: host.status?.[0]?.$?.state === 'up' ? 'online' : 'offline',
                  security: 'unknown',
                  lastSeen: new Date(host.status?.[0]?.$?.lastchanged * 1000).toISOString(),
                  bandwidth: 0,
                };
              });

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
    networkScanApiPlugin() // Add the custom plugin
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
