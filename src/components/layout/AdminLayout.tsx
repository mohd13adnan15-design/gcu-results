import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { AdminSession } from "@/lib/auth";
import { signOutEverywhere } from "@/lib/auth";
import type { PortalType } from "@/lib/types";
import { portalDisplayLabel } from "@/lib/portal";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { PortalNotificationsBell } from "@/components/notifications/PortalNotificationsBell";

interface Props {
  requirePortal: PortalType | PortalType[];
  title: string;
  subtitle?: string;
  tagline?: string;
  children: (session: AdminSession) => ReactNode;
}

export function AdminLayout({ requirePortal, title, subtitle, tagline, children }: Props) {
  const navigate = useNavigate();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!authSession?.user) {
        toast.error("Please sign in to continue");
        navigate("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("portal_profiles")
        .select("portal, email")
        .eq("user_id", authSession.user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !profile) {
        toast.error("No portal access for this account");
        await signOutEverywhere();
        navigate("/login");
        return;
      }

      const portal = profile.portal as PortalType;
      const allowed = Array.isArray(requirePortal) 
        ? requirePortal.includes(portal)
        : portal === requirePortal;

      if (!allowed) {
        toast.error("You do not have access to this area");
        navigate("/login");
        return;
      }

      setSession({
        userId: authSession.user.id,
        email: profile.email,
        portal,
      });
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
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
              {tagline && <p className="mt-1 text-xs text-muted-foreground">{tagline}</p>}
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <PortalNotificationsBell portal={session.portal} />
            <span className="hidden sm:inline text-sm text-muted-foreground">
              {session.email} · {portalDisplayLabel(session.portal)}
            </span>
            <button
              onClick={() => {
                void (async () => {
                  await signOutEverywhere();
                  navigate("/");
                })();
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
