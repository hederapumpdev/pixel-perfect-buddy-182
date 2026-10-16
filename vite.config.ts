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
};

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
          const m = /^(?:node:)?(events|buffer)\/?$/.exec(id);
          if (!m) return null;
          // Return the file directly: re-resolving a bare package can loop through
          // built-in aliases and produce invalid "node:events/" imports.
          return browserPolyfills[m[1] as keyof typeof browserPolyfills];
        },
      },
      {
        // The Hedera SDK pulls in @grpc/grpc-js, whose CJS init calls require("node:process"),
        // which crashes on the Worker runtime and takes every server function sharing that
        // bundle chunk down with it. Server code never talks gRPC, so stub it outside the browser.
        name: "server-grpc-stub",
        enforce: "pre",
        resolveId(id) {
          const env = (this as unknown as { environment?: { name?: string } }).environment?.name;
          if (env === "client") return null;
          return id === "@grpc/grpc-js" ? "\0grpc-server-stub" : null;
        },
        load(id) {
          if (id !== "\0grpc-server-stub") return null;
          return [
            "const fail = () => { throw new Error('gRPC is not available on the server'); };",
            "export class Client { constructor() { fail(); } }",
            "export class Metadata { set() {} }",
            "export const credentials = { createSsl: fail, createInsecure: fail };",
            "export default { Client, Metadata, credentials };",
          ].join("\n");
        },
      },
    ],
  },
});
