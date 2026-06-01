import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { setStudentSession, signOutEverywhere, type StudentSession } from "@/lib/auth";
import { LogOut, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  title?: string;
  tagline?: string;
  /** Show support contact footer (download page only). */
  showQueriesFooter?: boolean;
  children: (s: StudentSession) => ReactNode;
}

export function StudentLayout({
  title = "Student Portal",
  tagline,
  showQueriesFooter = false,
  children,
}: Props) {
  const navigate = useNavigate();
  const [session, setSession] = useState<StudentSession | null>(null);
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

      const uid = authSession.user.id;
      const email = (authSession.user.email ?? "").toLowerCase();

      let { data: row } = await supabase
        .from("students")
        .select("*")
        .eq("auth_user_id", uid)
        .maybeSingle();
      if (!row) {
        await supabase.rpc("link_student_auth_user");
        const again = await supabase
          .from("students")
          .select("*")
          .eq("auth_user_id", uid)
          .maybeSingle();
        row = again.data;
      }

      if (!row && email) {
        const byEmail = await supabase
          .from("students")
          .select("*")
          .eq("email", email)
          .maybeSingle();
        row = byEmail.data;
      }

      if (cancelled) return;
      if (!row) {
        toast.error("Student record not found for this account");
        await signOutEverywhere();
        navigate("/login");
        return;
      }

      const s: StudentSession = {
        id: row.id as string,
        student_id: row.student_id as string,
        email: row.email as string,
        full_name: row.full_name as string,
      };
      setStudentSession(s);
      setSession(s);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!ready || !session) return null;

  return (
    <div className="flex min-h-screen flex-col bg-grain">
      <header className="border-b border-border bg-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/student/dashboard" className="flex items-center gap-3">
            <img
              src="/gcu-logo.png"
              alt="Garden City University"
              className="h-10 w-10 rounded-md object-cover"
            />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Garden City University · Grade & Marks Card Portal
              </p>
              <h1 className="text-lg font-bold text-primary">{title}</h1>
              {tagline && <p className="mt-1 text-xs text-muted-foreground">{tagline}</p>}
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground">
              {session.full_name}
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children(session)}</main>
      {showQueriesFooter && (
        <div className="border-t border-border bg-cream/70">
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-4 text-center text-sm text-muted-foreground">
            <MessageCircle className="h-4 w-4 shrink-0 text-primary/70" aria-hidden />
            <p>
              If you have any queries, please write to{" "}
              <span className="font-semibold text-primary">pro.edu.gcu.in</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
