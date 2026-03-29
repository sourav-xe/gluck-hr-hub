import { defineConfig } from "vite";
import type { PreviewServer, ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "node:url";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// ESM-safe __dirname (Vite config may run where global __dirname is wrong)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function logWebStarted(server: ViteDevServer | PreviewServer, isDev: boolean) {
  const addr = server.httpServer?.address();
  const port =
    addr && typeof addr === "object" && "port" in addr
      ? addr.port
      : server.config.server.port;
  console.log("");
  console.log(isDev ? "========== HR Web (Vite dev) ==========" : "======== HR Web (Vite preview) =========");
  console.log("[HR Web] Server started on port", port);
  console.log("[HR Web] Local URL = http://localhost:" + port);
  if (isDev) {
    console.log("[HR Web] API proxy = /api -> http://127.0.0.1:3001");
  }
  console.log("========================================");
  console.log("");
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // frontend/ folder (index.html + src/)
  root: __dirname,
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Browser calls /api on :8080 → forwarded to Express on :3001
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        // PDF merge + conversion can run several minutes (LibreOffice / Puppeteer)
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
    },
  },
  css: {
    // Inline PostCSS so dev + build both process Tailwind (avoids cwd/path bugs on Windows)
    postcss: {
      plugins: [
        tailwindcss({ config: path.join(__dirname, "tailwind.config.ts") }),
        autoprefixer(),
      ],
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../dist"),
    emptyOutDir: true,
  },
  plugins: [
    {
      name: "hr-web-start-log",
      configureServer(server) {
        server.httpServer?.once("listening", () => {
          logWebStarted(server, true);
        });
      },
      configurePreviewServer(server) {
        server.httpServer?.once("listening", () => {
          logWebStarted(server, false);
        });
      },
    },
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
