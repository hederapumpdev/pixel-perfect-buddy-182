// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Wallet libraries (WalletConnect / Hedera / Web3Auth) import Node's "events" and "buffer".
    // In the browser bundle those become empty stubs ("EventEmitter is not a constructor"),
    // so map them to the npm browser polyfills — client build only.
    plugins: [
      {
        name: "browser-node-polyfills",
        enforce: "pre",
        async resolveId(id, importer, opts) {
          const env = (this as unknown as { environment?: { name?: string } }).environment?.name;
          if (env !== "client") return null;
          const m = /^(?:node:)?(events|buffer)$/.exec(id);
          if (!m) return null;
          return this.resolve(m[1] + "/", importer, { ...opts, skipSelf: true });
        },
      },
    ],
  },
});
