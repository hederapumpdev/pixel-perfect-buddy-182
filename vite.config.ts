// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const browserPolyfills = {
  events: require.resolve("events/"),
  buffer: require.resolve("buffer/"),
  process: require.resolve("process/browser.js"),
};
const SERVER_STUBBED =
  /^(@hashgraph\/hedera-wallet-connect|@hiero-ledger\/sdk|@web3auth\/modal|@web3auth\/no-modal|@grpc\/grpc-js)(\/.*)?$/;

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
        resolveId(id) {
          const env = (this as unknown as { environment?: { name?: string } }).environment?.name;
          if (env !== "client") return null;
          const m = /^(?:node:)?(events|buffer|process)\/?$/.exec(id);
          if (!m) return null;
          // Return the file directly: re-resolving a bare package can loop through
          // built-in aliases and produce invalid "node:events/" imports.
          return browserPolyfills[m[1] as keyof typeof browserPolyfills];
        },
      },
      {
        // Wallet SDKs are browser-only and only loaded via dynamic import inside the browser.
        // Bundled for the Worker they crash at load (grpc-js require("node:process"),
        // HTMLElement web components), and the server bundler merges viem/ethers into that
        // same chunk — killing every server function. Stub them out of server builds.
        name: "server-wallet-sdk-stub",
        enforce: "pre",
        apply: "build",
        resolveId(id) {
          const env = (this as unknown as { environment?: { name?: string } }).environment?.name;
          if (env === "client") return null;
          return SERVER_STUBBED.test(id) ? "\0wallet-sdk-server-stub" : null;
        },
        load(id) {
          if (id !== "\0wallet-sdk-server-stub") return null;
          return "export default {};";
        },
      },
    ],
  },
});
