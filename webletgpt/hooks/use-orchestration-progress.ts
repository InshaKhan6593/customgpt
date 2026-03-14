"use client";

import { useState, useEffect } from "react";

export interface ProgressEvent {
  type: string;
  data: any;
  timestamp: Date;
}

export function useOrchestrationProgress(sessionId: string | null) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setEvents([]);
      setIsConnected(false);
      return;
    }

    setEvents([]);
    let aborted = false;
    let reader: ReadableStreamDefaultReader<any> | null = null;

    const run = async () => {
      try {
        // Fetch a short-lived subscription token scoped to this session's channel
        const res = await fetch(
          `/api/flows/realtime-token?sessionId=${encodeURIComponent(sessionId)}`
        );
        if (!res.ok || aborted) return;
        const { token } = await res.json();
        if (aborted) return;

        // Dynamic import keeps this off the SSR bundle
        const { subscribe } = await import("@inngest/realtime");
        const stream = await subscribe(token);
        if (aborted) return;

        setIsConnected(true);
        reader = (stream as ReadableStream<any>).getReader();

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done || aborted) break;
          // Each message: { topic: "events", data: { event: string, data: any } }
          const payload = value?.data as { event: string; data: any } | undefined;
          if (payload?.event) {
            setEvents(prev => [
              ...prev,
              { type: payload.event, data: payload.data ?? {}, timestamp: new Date() },
            ]);
          }
        }
      } catch (err) {
        if (!aborted) console.error("[Realtime] Subscription error:", err);
      } finally {
        reader?.releaseLock();
        if (!aborted) setIsConnected(false);
      }
    };

    run();

    return () => {
      aborted = true;
      reader?.cancel().catch(() => {});
      setIsConnected(false);
    };
  }, [sessionId]);

  return { events, isConnected, setEvents };
}
