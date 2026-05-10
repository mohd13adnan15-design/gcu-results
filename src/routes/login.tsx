import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearStudentSession, setStudentSession, signOutEverywhere } from "@/lib/auth";
import type { PortalType, Student } from "@/lib/types";
import { portalHomePath } from "@/lib/portal";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "lucide-react";

async function loadStaffPortal(userId: string): Promise<PortalType | null> {
  const { data, error } = await supabase
    .from("portal_profiles")
    .select("portal")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.portal as PortalType;
}

async function loadStudentAfterAuth(userId: string, email: string): Promise<Student | null> {
  const { data: linked } = await supabase
    .from("students")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (linked) return linked as Student;

  await supabase.rpc("link_student_auth_user");

  const { data: afterLink } = await supabase
    .from("students")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (afterLink) return afterLink as Student;

  const { data: byEmail } = await supabase
    .from("students")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return (byEmail as Student | null) ?? null;
}

export function UnifiedLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = email.trim().toLowerCase();
    if (!id || !password) return;
    setLoading(true);

    try {
      await signOutEverywhere();

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: id,
        password,
      });

      if (authError || !authData.user) {
        const msg = authError?.message ?? "Invalid credentials";
        if (/email not confirmed/i.test(msg)) {
          const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email: id,
            options: { emailRedirectTo: `${window.location.origin}/login` },
          });
          if (resendError) {
            toast.error(
              "Email not confirmed. Could not resend confirmation email. Contact Admin to confirm this account.",
            );
          } else {
            toast.error(
              "Email not confirmed. A new confirmation email has been sent. Please verify your email, then sign in again.",
            );
          }
          return;
        }
        toast.error(authError?.message ?? "Invalid credentials");
        return;
      }

      const user = authData.user;
      const sessionEmail = (user.email ?? id).toLowerCase();

      // Ensure JWT is attached before RLS-protected reads (avoids rare race after sign-in).
      await supabase.auth.getSession();

      const portal = await loadStaffPortal(user.id);
      if (portal) {
        clearStudentSession();
        toast.success("Signed in");
        navigate(portalHomePath(portal));
        return;
      }

      const studentRow = await loadStudentAfterAuth(user.id, sessionEmail);
      if (studentRow) {
        setStudentSession({
          id: studentRow.id,
          student_id: studentRow.student_id,
          email: studentRow.email,
          full_name: studentRow.full_name,
        });
        toast.success(`Welcome, ${studentRow.full_name}`);
        navigate("/student/dashboard");
        return;
      }

      await supabase.auth.signOut();
      clearStudentSession();
      toast.error(
        "This account is not linked to a student record or staff portal. Check your email or contact the Admin 2 office.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-grain flex flex-col">
      <header className="border-b border-border bg-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-primary hover:opacity-80">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <div className="flex items-center gap-2">
            <img
              src="/gcu-logo.png"
              alt="Garden City University"
              className="h-7 w-7 rounded-md object-cover"
            />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Garden City University
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md card-elevated rounded-2xl p-8">
          <div className="mb-6 flex items-center gap-3">
            <img
              src="/gcu-logo.png"
              alt="Garden City University"
              className="h-12 w-12 rounded-md object-cover"
            />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Garden City University
              </p>
              <h1 className="text-2xl font-bold text-primary">Sign in</h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                type="email"
                className="w-full rounded-md border border-border bg-cream px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@gcu.edu.in"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use the email registered for your staff or student account.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-md border border-border bg-cream px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (
                "Signing in…"
              ) : (
                <>
                  Sign in <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
            After sign-in you are routed to the correct workspace for your role. New user?{" "}
            <Link to="/signup" className="font-medium text-primary hover:opacity-80">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
