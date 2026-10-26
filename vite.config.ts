import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },

  server: {
    // `mygo dev` 加载这个地址(mygo.config.ts 的 devUrl)
    port: 5173,
    strictPort: true,
    // 开发版应用与打包产物不属于页面
    watch: { ignored: ["**/.mygo/**", "**/build/**", "**/legacy/**"] },
  },
});
