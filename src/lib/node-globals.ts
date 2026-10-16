// Node's `process.nextTick` is called by the Hedera/gRPC wallet SDKs. Browsers
// have no `process`, so the published bundle crashed with
// "n.nextTick is not a function" as soon as a wallet popup was opened.
// This installs the browser shim before any wallet library is loaded.
import processShim from "process/browser.js";

const g = globalThis as unknown as { process?: unknown };
if (!g.process) g.process = processShim;
