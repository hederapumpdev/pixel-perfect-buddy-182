import { createFileRoute } from "@tanstack/react-router";

const INSTRUCTIONS = `You are the HederaPump support assistant. HederaPump is a Pump.fun-style meme coin launchpad on Hedera mainnet.
Facts:
- Coins are real Hedera (HTS) tokens with 8 decimals and 1 billion supply; no mint, no freeze.
- Trading happens on a bonding curve in the HederaPump contract: buys raise the price, sells lower it.
- Trading fee is 1%: 30% goes to the coin creator (claim via "Claim fees" on the Profile page), 70% to the platform.
- Creating a coin costs about 10 HBAR plus up to 20 HBAR for the token itself (unused part refunded), plus any "Buy at launch" amount. Keep ~30 HBAR extra in the wallet.
- At 800 million tokens sold the coin graduates and is automatically listed on SaucerSwap with locked liquidity.
- Wallets: HashPack and other Hedera wallets via WalletConnect, MetaMask (Hedera network is added automatically), or Sign in with email/Google for trading without approval popups.
- First buy of a coin asks once to add (associate) the token; first sell asks once for permission (allowance).
- "Insufficient payer balance" means not enough HBAR. A new MetaMask address needs HBAR sent to it first.
- Coins can be followed on HashScan with their contract address (CA).
Rules: answer briefly and in the user's language. Never ask for private keys or seed phrases and warn if someone offers them. Never give financial advice. If you can't solve the problem, tell the user to use the "Contact a human" form on this page.`;

type Msg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/public/support-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { messages?: Msg[] } | null;
        const messages = (body?.messages ?? [])
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
        if (!messages.length || messages[messages.length - 1]?.role !== "user")
          return Response.json({ error: "Send a question" }, { status: 400 });
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "Support AI isn't configured" }, { status: 500 });

        const { createOpenAI } = await import("@ai-sdk/openai");
        const { streamText } = await import("ai");
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });
        let failure: string | null = null;
        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          instructions: INSTRUCTIONS,
          messages,
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: "low",
              include: ["reasoning.encrypted_content"],
            },
          },
          onError: ({ error }: { error: unknown }) => {
            failure = error instanceof Error ? error.message : String(error);
            console.error("support-chat", failure);
          },
        } as never);
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(ctrl) {
            try {
              for await (const t of result.textStream) ctrl.enqueue(enc.encode(t));
            } catch {
              /* reported below */
            }
            if (failure) ctrl.enqueue(enc.encode("\n\n_Support AI is unavailable right now — please use the contact form below._"));
            ctrl.close();
          },
        });
        return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      },
    },
  },
});
