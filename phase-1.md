### Context & Objective

We are building "FlashBets," a high-frequency decentralized micro-prediction market for the World Cup on Solana. The frontend is built using Next.js, TailwindCSS, and TypeScript.

### Task Instructions

1. Create a mock data simulation utility in `src/lib/mockTxLine.ts` that mimics the real-time TxLINE Server-Sent Events (SSE) stream for World Cup match data.
2. The mock structure must emit normalized JSON updates every 10–15 seconds to simulate match time passing, scores changing, and specific match events occurring (e.g., corners, fouls, yellow cards).
3. Create a Next.js API route (`src/app/api/stream/route.ts`) that implements an SSE endpoint. This endpoint will read from our data simulation and stream live match statistics and odds configurations to the frontend.
4. Ensure the SSE stream properly headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `Connection: keep-alive`.
