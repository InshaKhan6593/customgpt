import { useState, useEffect } from "react";
import * as Ably from "ably";

export interface ProgressEvent {
  type: string;
  data: any;
  timestamp: Date;
}

export function useOrchestrationProgress(sessionId: string | null) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    
    // We assume the NEXT_PUBLIC_ABLY_KEY is exposed for client connections
    const key = process.env.NEXT_PUBLIC_ABLY_KEY;
    if (!key) {
      console.warn("NEXT_PUBLIC_ABLY_KEY is missing. Realtime updates won't work.");
      return;
    }

    const ably = new Ably.Realtime({ key });
    
    ably.connection.on("connected", () => setIsConnected(true));
    ably.connection.on("disconnected", () => setIsConnected(false));
    ably.connection.on("failed", () => setIsConnected(false));

    const channel = ably.channels.get(`orchestration:${sessionId}`);

    channel.subscribe((msg) => {
      setEvents((prev) => [
        ...prev, 
        { type: msg.name || "unknown", data: msg.data, timestamp: new Date() }
      ]);
    });

    return () => {
      channel.unsubscribe();
      ably.close();
    };
  }, [sessionId]);

  return { events, isConnected, setEvents };
}
