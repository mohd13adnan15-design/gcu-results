import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isLibraryRemoteConfigured } from "@/integrations/supabase/library-remote-client";
import { StudentLayout } from "@/components/StudentLayout";
import type { Student } from "@/lib/types";
import {
  fetchLibraryPenalties,
  resolveLibraryRemoteProfileId,
  type LibraryPenaltyRow,
} from "@/lib/library-remote";
import { ArrowLeft, CheckCircle2, Circle, Lock, AlertCircle } from "lucide-react";
import { getStudentSession } from "@/lib/auth";

interface Book {
  id: string;
  title: string;
  author: string | null;
  borrowed_at: string;
  returned: boolean;
  returned_at: string | null;
}

export const Route = createFileRoute("/student/library")({
  head: () => ({ meta: [{ title: "Library — GCU Result Portal" }] }),
  component: () => <StudentLayout title="Library">{() => <LibraryView />}</StudentLayout>,
});

function LibraryView() {
  const [student, setStudent] = useState<Student | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [penalties, setPenalties] = useState<LibraryPenaltyRow[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  useEffect(() => {
    const s = getStudentSession();
    if (!s) return;
    Promise.all([
      supabase.from("students").select("*").eq("id", s.id).maybeSingle(),
      supabase.from("library_books").select("*").eq("student_id", s.id).order("borrowed_at"),
    ]).then(([sRes, bRes]) => {
      setStudent(sRes.data as Student | null);
      setBooks((bRes.data as Book[]) ?? []);
    });
  }, []);

  useEffect(() => {
    if (!student?.in_library) {
      setPenalties([]);
      setRemoteError(null);
      return;
    }
    const profileId = resolveLibraryRemoteProfileId(student);
    if (!profileId || !isLibraryRemoteConfigured()) {
      setPenalties([]);
      setRemoteError(null);
      setRemoteLoading(false);
      return;
    }
    setRemoteLoading(true);
    setRemoteError(null);
    fetchLibraryPenalties(profileId)
      .then((rows) => {
        setPenalties(rows);
      })
      .catch((e: Error) => {
        setPenalties([]);
        setRemoteError(e.message ?? "Could not load library penalties");
      })
      .finally(() => setRemoteLoading(false));
  }, [student]);

  if (!student) return <p className="text-muted-foreground">Loading…</p>;

  if (!student.in_library) {
    return (
      <div className="space-y-6">
        <Link
          to="/student/dashboard"
          className="inline-flex items-center gap-2 text-primary hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="card-elevated rounded-2xl p-10 text-center">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-2xl font-bold text-primary">Not registered with library</h2>
          <p className="mt-2 text-muted-foreground">
            Library clearance and central-library penalties aren’t shown for your account — this is
            expected if you aren’t enrolled in the library portal.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            You can still complete other clearance steps and generate your marks card when eligible.
          </p>
        </div>
      </div>
    );
  }

  const allReturned =
    books.every((b) => b.returned) && (books.length > 0 || student.library_cleared);

  const remoteConfigured = isLibraryRemoteConfigured();
  const remoteProfileId = resolveLibraryRemoteProfileId(student);

  return (
    <div className="space-y-6">
      <Link
        to="/student/dashboard"
        className="inline-flex items-center gap-2 text-primary hover:opacity-80"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Central library DB — overdue penalties */}
      <div className="card-elevated rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 shrink-0 text-primary mt-0.5" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-primary">Central library penalties</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fines from the separate library-management system (overdue loans). Updates when that
              system records overdue days and amounts.
            </p>
          </div>
        </div>

        {!remoteConfigured && (
          <p className="mt-4 text-sm text-muted-foreground">
            Library integration is not configured on this deployment (
            <code className="text-xs">VITE_LIBRARY_SUPABASE_*</code>).
          </p>
        )}
        {remoteConfigured && !remoteProfileId && (
          <p className="mt-4 text-sm text-amber-900">
            Your account isn’t linked to the central library system yet — fees from that system
            won’t appear. Ask an administrator to set{" "}
            <code className="text-xs">library_remote_profile_id</code> for your profile or configure{" "}
            <code className="text-xs">VITE_LIBRARY_PROFILE_MAP_JSON</code>.
          </p>
        )}
        {remoteError && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {remoteError}
          </p>
        )}
        {remoteConfigured && remoteProfileId && (
          <>
            {remoteLoading ? (
              <p className="mt-4 text-muted-foreground">Loading penalties…</p>
            ) : penalties.length === 0 ? (
              <p className="mt-4 text-muted-foreground">
                No overdue penalties on your library account.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-primary">
                    <tr className="text-left">
                      <th className="py-2 px-3">Days overdue</th>
                      <th className="py-2 px-3 text-right">Fine / day</th>
                      <th className="py-2 px-3 text-right">Total fine</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      <th className="py-2 px-3 hidden sm:table-cell">Calculated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {penalties.map((p) => (
                      <tr key={p.id} className="border-t border-border/60 hover:bg-secondary/30">
                        <td className="py-2 px-3">{p.days_overdue}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          ₹{Number(p.fine_per_day).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium">
                          ₹{Number(p.total_fine).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs uppercase tracking-wider ${
                              p.status === "paid"
                                ? "bg-primary text-primary-foreground"
                                : "bg-accent text-primary"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell text-xs">
                          {new Date(p.calculated_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card-elevated rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-primary">Borrowed books</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allReturned || student.library_cleared}
              readOnly
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            All books returned
          </label>
        </div>

        <ul className="mt-5 divide-y divide-border">
          {books.length === 0 && (
            <li className="py-4 text-muted-foreground">No books on record in this portal.</li>
          )}
          {books.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {b.returned ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-primary">{b.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.author ?? "Unknown"} · borrowed {b.borrowed_at}
                  </p>
                </div>
              </div>
              <span
                className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  b.returned ? "bg-primary text-primary-foreground" : "bg-accent text-primary"
                }`}
              >
                {b.returned ? "Returned" : "Pending"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
