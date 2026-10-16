// The npm "process" browser shim ships without type declarations.
declare module "process/browser.js" {
  const processShim: {
    nextTick: (callback: (...args: never[]) => void, ...args: never[]) => void;
    env: Record<string, string | undefined>;
    title: string;
    browser: boolean;
    version: string;
    platform: string;
    argv: string[];
  };
  export default processShim;
}
