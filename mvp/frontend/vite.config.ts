import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE_PATH || "/";

  return {
    base,
    plugins: [react()],
    server: {
      // true = 127.0.0.1 + localhost (IPv4/IPv6), иначе localhost на Windows часто не открывается
      host: true,
      port: 5174,
      strictPort: true,
      open: true,
    },
    preview: {
      host: true,
      port: 5174,
      strictPort: false,
    },
  };
});
