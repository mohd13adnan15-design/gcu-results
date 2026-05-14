import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PortalType } from "@/lib/types";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function PortalNotificationsBell({ portal }: { portal: PortalType }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("portal_notifications")
      .select("id, title, message, is_read, created_at")
      .eq("recipient_portal", portal)
      .order("created_at", { ascending: false })
      .limit(20);
    setRows((data as NotificationRow[]) ?? []);
  }, [portal]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`notifications:${portal}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portal_notifications" },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [portal, load]);

  const unread = useMemo(() => rows.filter((row) => !row.is_read).length, [rows]);

  async function markAllRead() {
    const unreadIds = rows.filter((row) => !row.is_read).map((row) => row.id);
    if (unreadIds.length === 0) return;
    await supabase.from("portal_notifications").update({ is_read: true }).in("id", unreadIds);
    await load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex items-center justify-center rounded-md border border-border bg-cream p-2 text-primary hover:bg-secondary"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-border bg-cream p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">Notifications</p>
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-primary"
              type="button"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 space-y-2 overflow-auto">
            {rows.length === 0 ? (
              <p className="rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className={`rounded-md border p-2 text-xs ${
                    row.is_read ? "border-border bg-secondary/30" : "border-primary/20 bg-accent/40"
                  }`}
                >
                  <p className="font-semibold text-primary">{row.title}</p>
                  <p className="mt-1 text-muted-foreground">{row.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
