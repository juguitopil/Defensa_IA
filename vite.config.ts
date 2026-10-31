import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { selloApi } from "./server/ai-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), selloApi()],
});
