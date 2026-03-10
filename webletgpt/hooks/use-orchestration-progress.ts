import { useState, useEffect } from "react";
import * as Ably from "ably";

export interface ProgressEvent {
  type: string;
  data: any;
  timestamp: Date;
}

let globalAblyClient: Ably.Realtime | null = null;

export function useOrchestrationProgress(sessionId: string | null) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setEvents([]);
      return;
    }

    setEvents([]); // Clear old events when a new session starts

    const key = process.env.NEXT_PUBLIC_ABLY_KEY;
    if (!key) {
      console.warn("NEXT_PUBLIC_ABLY_KEY is missing. Realtime updates won't work.");
      return;
    }

    if (!globalAblyClient) {
      globalAblyClient = new Ably.Realtime({ key });
    }

    const ably = globalAblyClient;

    const onConnected = () => setIsConnected(true);
    const onDisconnected = () => setIsConnected(false);

    // Check initial state
    if (ably.connection.state === "connected") setIsConnected(true);

    ably.connection.on("connected", onConnected);
    ably.connection.on("disconnected", onDisconnected);
    ably.connection.on("failed", onDisconnected);

    const channel = ably.channels.get(`orchestration:${sessionId}`);

    channel.subscribe((msg) => {
      setEvents((prev) => {
        const newEvent = { type: msg.name || "unknown", data: msg.data, timestamp: new Date() };
        console.log("[Execution Event]:", newEvent);
        return [...prev, newEvent];
      });
    });

    return () => {
      // Unsubscribe from this specific channel
      channel.unsubscribe();

      // Remove listeners so we don't leak them
      ably.connection.off("connected", onConnected);
      ably.connection.off("disconnected", onDisconnected);
      ably.connection.off("failed", onDisconnected);
    };
  }, [sessionId]);

  return { events, isConnected, setEvents };
}
