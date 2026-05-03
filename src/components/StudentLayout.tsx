import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { getStudentSession, clearStudentSession, type StudentSession } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

interface Props {
  title?: string;
  children: (s: StudentSession) => ReactNode;
}

export function StudentLayout({ title = "Student Portal", children }: Props) {
  const navigate = useNavigate();
  const [session, setSession] = useState<StudentSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getStudentSession();
    if (!s) {
      toast.error("Please sign in to continue");
      navigate({ to: "/login" });
      return;
    }
    setSession(s);
    setReady(true);
  }, [navigate]);

  if (!ready || !session) return null;

  return (
    <div className="min-h-screen bg-grain">
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
                Garden City University · Result Portal
              </p>
              <h1 className="text-lg font-bold text-primary">{title}</h1>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground">
              {session.full_name}
            </span>
            <button
              onClick={() => {
                clearStudentSession();
                navigate({ to: "/" });
              }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-cream px-3 py-1.5 text-sm text-primary hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children(session)}</main>
    </div>
  );
}
