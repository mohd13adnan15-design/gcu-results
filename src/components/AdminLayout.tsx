import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { getAdminSession, clearAdminSession, type AdminSession } from "@/lib/auth";
import type { PortalType } from "@/lib/types";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { PortalNotificationsBell } from "@/components/PortalNotificationsBell";

interface Props {
  requirePortal: PortalType;
  title: string;
  subtitle?: string;
  children: (session: AdminSession) => ReactNode;
}

export function AdminLayout({ requirePortal, title, subtitle, children }: Props) {
  const navigate = useNavigate();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getAdminSession();
    if (!s || s.portal !== requirePortal) {
      toast.error("Please sign in to continue");
      navigate({ to: "/login" });
      return;
    }
    setSession(s);
    setReady(true);
  }, [navigate, requirePortal]);

  if (!ready || !session) return null;

  return (
    <div className="min-h-screen bg-grain">
      <header className="border-b border-border bg-cream">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/gcu-logo.png"
              alt="Garden City University"
              className="h-10 w-10 rounded-md object-cover"
            />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {subtitle ?? "Garden City University · Result Portal"}
              </p>
              <h1 className="text-lg font-bold text-primary">{title}</h1>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <PortalNotificationsBell portal={session.portal} />
            <span className="hidden sm:inline text-sm text-muted-foreground">
              {session.username} · {session.portal.replace("_", " ")}
            </span>
            <button
              onClick={() => {
                clearAdminSession();
                navigate({ to: "/" });
              }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-3 py-1.5 text-sm text-primary hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children(session)}</main>
    </div>
  );
}
