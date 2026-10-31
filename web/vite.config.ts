import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "runtime-deployment-in-development",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = (req.url ?? "").split("?")[0];
          if (
            path !== "/imd-deployment.json" &&
            !/^\/abi\/[A-Za-z0-9_]+\.json$/.test(path)
          )
            return next();
          readFile(new URL(`../dist/${path.slice(1)}`, import.meta.url))
            .then((bytes) => {
              res.setHeader("content-type", "application/json");
              res.end(bytes);
            })
            .catch(() => {
              res.statusCode = 503;
              res.end(
                "Run npm run build once to prepare the attested runtime deployment.",
              );
            });
        });
      },
    },
  ],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
