import { channel, topic } from "@inngest/realtime";

// Typed channel for orchestration progress events.
// Each message carries { event: string, data: any } so the frontend
// can use the same event-type dispatch it was already doing with Ably.
export const orchestrationChannel = channel(
  (sessionId: string) => `orchestration:${sessionId}`
).addTopic(topic("events").type<{ event: string; data: any }>());

export type OrchestratorPublish = (msg: any) => Promise<void>;

export async function publishProgress(
  publish: OrchestratorPublish,
  sessionId: string,
  event: string,
  data: any
) {
  try {
    await publish(orchestrationChannel(sessionId).events({ event, data }));
  } catch (error) {
    console.error("[Realtime] Failed to publish:", event, error);
  }
}
