import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

function packStatic(): Plugin {
  return {
    name: "sello-pack-extension",
    closeBundle() {
      const out = resolve(root, "dist-extension");
      mkdirSync(resolve(out, "icons"), { recursive: true });
      copyFileSync(resolve(root, "src/extension/manifest.json"), resolve(out, "manifest.json"));
      copyFileSync(resolve(root, "src/extension/background.js"), resolve(out, "background.js"));
      copyFileSync(resolve(root, "src/extension/popup.html"), resolve(out, "popup.html"));
      copyFileSync(resolve(root, "src/extension/popup.js"), resolve(out, "popup.js"));
      copyFileSync(resolve(root, "public/favicon.svg"), resolve(out, "icons/pumpkin.svg"));
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [react(), packStatic()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist-extension",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(root, "src/extension/content.tsx"),
      name: "Sello",
      formats: ["iife"],
      fileName: () => "content.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
