import { defineConfig } from "mygo-cli";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  name: "lol-material-tool",
  identifier: "com.zker67.lol-material-tool",
  version: pkg.version,
  copyright: "© 2026 zker67",
  icon: "assets/app_icon.png",
  // `mygo dev` 运行 devCommand 并加载 devUrl;`mygo build` 运行 buildCommand 并把 frontendDist 嵌入程序。
  devUrl: "http://localhost:5173",
  devCommand: "bun run dev:web",
  buildCommand: "bun run build:web",
  frontendDist: "dist",
  bindings: "src/mygo.ts",
  out: "build",
});
