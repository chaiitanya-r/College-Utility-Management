import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Inline assets smaller than 4KB as base64 (reduces network requests)
    assetsInlineLimit: 4096,
    // Enable CSS code splitting per chunk
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split charting library (heavy)
          if (id.includes("recharts")) return "recharts";
          // Split Radix UI primitives (large collection)
          if (id.includes("@radix-ui")) return "radix-ui";
          // Split Lucide icons
          if (id.includes("lucide-react")) return "lucide-icons";
          // Split React Query
          if (id.includes("@tanstack/react-query")) return "react-query";
          // Split date utilities
          if (id.includes("date-fns")) return "date-fns";
        },
      },
    },
  },
}));
