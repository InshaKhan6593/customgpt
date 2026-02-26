import { ably } from "@/lib/ably";

export async function publishProgress(sessionId: string, event: string, data: any) {
  try {
    const channel = ably.channels.get(`orchestration:${sessionId}`);
    await channel.publish(event, data);
  } catch (error) {
    console.error("Failed to publish Ably event:", event, error);
  }
}
