import type {
  RealtimePostgresChangesFilter,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

const DEFAULT_POLL_MS = 30_000;

type PostgresBinding = RealtimePostgresChangesFilter<"*">;

/**
 * Subscribe to postgres_changes with polling fallback when Realtime WebSocket is unavailable.
 */
export function subscribePostgresChanges(
  channelName: string,
  bindings: PostgresBinding[],
  onChange: (payload?: RealtimePostgresChangesPayload<"*">) => void,
  options?: { pollMs?: number },
): () => void {
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  let pollId: ReturnType<typeof setInterval> | null = null;
  let fallbackActive = false;

  const startPolling = () => {
    if (fallbackActive) return;
    fallbackActive = true;
    pollId = setInterval(() => {
      void onChange();
    }, pollMs);
  };

  const stopPolling = () => {
    if (pollId) {
      clearInterval(pollId);
      pollId = null;
    }
    fallbackActive = false;
  };

  let channel = supabase.channel(channelName);
  for (const binding of bindings) {
    channel = channel.on(
      "postgres_changes",
      binding,
      (payload) => {
        void onChange(payload);
      },
    );
  }

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      stopPolling();
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      startPolling();
    }
  });

  return () => {
    stopPolling();
    void supabase.removeChannel(channel);
  };
}
