import Ably from "ably";

// Server-side Ably client — only initialized when the API key is present.
// Throwing at module-level when the key is missing would crash every route
// that imports this file (including the Inngest route).
const ablyKey = process.env.ABLY_API_KEY;

if (!ablyKey) {
  console.warn("[Ably] ABLY_API_KEY is not set. Real-time orchestration progress will not be published.");
}

export const ably = ablyKey
  ? new Ably.Rest({ key: ablyKey })
  : null;
