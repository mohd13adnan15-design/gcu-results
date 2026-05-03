import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Mirror non-VITE_ Supabase keys onto VITE_ ones so the existing client
  // (which reads import.meta.env.VITE_SUPABASE_*) keeps working in the browser.
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_PUBLISHABLE_KEY;

  const libraryUrl = env.VITE_LIBRARY_SUPABASE_URL ?? env.LIBRARY_SUPABASE_URL ?? "";
  const libraryAnonKey = env.VITE_LIBRARY_SUPABASE_ANON_KEY ?? env.LIBRARY_SUPABASE_ANON_KEY ?? "";

  return {
    plugins: [
      TanStackRouterVite({
        target: "react",
        autoCodeSplitting: true,
        routesDirectory: "src/routes",
        generatedRouteTree: "src/routeTree.gen.ts",
      }),
      react(),
      tailwindcss(),
      tsconfigPaths(),
    ],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl ?? ""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey ?? ""),
      "import.meta.env.VITE_LIBRARY_SUPABASE_URL": JSON.stringify(libraryUrl),
      "import.meta.env.VITE_LIBRARY_SUPABASE_ANON_KEY": JSON.stringify(libraryAnonKey),
    },
    server: {
      port: 5173,
      host: true,
    },
    preview: {
      port: 4173,
      host: true,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
    },
  };
});
