import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "./",
  plugins: [react()],
  publicDir: "reader-public",
  server: { watch: { ignored: ["**/.local/**"] } },
  build: { outDir: "dist" },
});
