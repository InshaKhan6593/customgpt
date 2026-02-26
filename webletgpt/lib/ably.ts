import Ably from "ably";

// Server-side Ably client
export const ably = new Ably.Rest({
  key: process.env.ABLY_API_KEY,
});
