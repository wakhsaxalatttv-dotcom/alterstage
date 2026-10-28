import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
  build: {
    rollupOptions: {
      input: {
        public: fileURLToPath(new URL("./index.html", import.meta.url)),
        administration: fileURLToPath(
          new URL("./administration/index.html", import.meta.url),
        ),
      },
    },
  },
});
