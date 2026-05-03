import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  setAdminSession,
  setStudentSession,
  clearAdminSession,
  clearStudentSession,
} from "@/lib/auth";
import type { PortalType, Student } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface PortalAdminRow {
  id: string;
  username: string;
  password: string;
  portal: PortalType;
  created_at: string;
}

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — GCU Result Portal" }] }),
  component: UnifiedLogin,
});

function portalRoute(portal: PortalType): string {
  switch (portal) {
    case "super_admin":
      return "/super-admin";
    case "faculty":
      return "/faculty";
    case "admin":
      return "/admin";
    case "library":
      return "/library";
    case "hostel":
      return "/hostel";
    case "fees":
      return "/fees";
    default: {
      const _exhaustiveCheck: never = portal;
      return _exhaustiveCheck;
    }
  }
}

async function tryStudent(identifier: string, password: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("email", identifier.toLowerCase())
    .eq("password", password)
    .maybeSingle();
  if (error) return null;
  return (data as Student | null) ?? null;
}

async function tryAdmin(identifier: string, password: string): Promise<PortalAdminRow | null> {
  const { data, error } = await supabase
    .from("portal_admins")
    .select("*")
    .eq("username", identifier)
    .eq("password", password)
    .maybeSingle();
  if (error) return null;
  return (data as PortalAdminRow | null) ?? null;
}

function UnifiedLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setLoading(true);

    const id = identifier.trim();
    const looksLikeEmail = id.includes("@");

    let studentRow: Student | null = null;
    let adminRow: PortalAdminRow | null = null;

    // Try the most likely table first based on the identifier shape, then fall back.
    if (looksLikeEmail) {
      studentRow = await tryStudent(id, password);
      if (!studentRow) adminRow = await tryAdmin(id, password);
    } else {
      adminRow = await tryAdmin(id, password);
      if (!adminRow) studentRow = await tryStudent(id, password);
    }

    setLoading(false);

    if (studentRow) {
      // Make sure no stale admin session lingers from a previous user.
      clearAdminSession();
      setStudentSession({
        id: studentRow.id,
        student_id: studentRow.student_id,
        email: studentRow.email,
        full_name: studentRow.full_name,
      });
      toast.success(`Welcome, ${studentRow.full_name}`);
      navigate({ to: "/student/dashboard" });
      return;
    }

    if (adminRow) {
      clearStudentSession();
      const portal = adminRow.portal;
      setAdminSession({
        id: adminRow.id,
        username: adminRow.username,
        portal,
      });
      toast.success(`Welcome, ${adminRow.username}`);
      navigate({ to: portalRoute(portal) });
      return;
    }

    toast.error("Invalid credentials");
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
              <label className="block text-sm font-medium text-primary mb-1">
                Email or Username
              </label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                className="w-full rounded-md border border-border bg-cream px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@gcu.edu.in"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use your university email or staff username.
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
            Your access is determined automatically from your credentials — you'll be taken to the
            right workspace once you sign in.
          </p>
        </div>
      </div>
    </div>
  );
}
