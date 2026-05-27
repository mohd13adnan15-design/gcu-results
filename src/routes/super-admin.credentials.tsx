import { Link } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { PortalType } from "@/lib/types";
import { portalDisplayLabel } from "@/lib/portal";
import { toast } from "sonner";
import { ArrowLeft, Plus, ShieldCheck, Trash2 } from "lucide-react";

type ProfileRow = {
  user_id: string;
  portal: PortalType;
  email: string;
  created_at: string;
};

export function CredentialsPage() {
  return (
    <AdminLayout
      requirePortal={["admin_1", "head_of_coe"]}
      title="Manage access"
      subtitle="Garden City University · Grade & Marks Card Portal"
    >
      {() => (
        <div className="space-y-6">
          <Link
            to="/coe"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to COE
          </Link>
          <div className="grid gap-6 lg:grid-cols-3">
            <CredentialCreator />
            <CredentialList />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function CredentialCreator() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    portal: "admin_1" as PortalType,
  });

  async function addStaff(e: FormEvent) {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!email || !form.password.trim()) return;
    const { error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        data: { portal: form.portal },
      },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      "Invitation sent - if email confirmation is enabled, the user must confirm before sign-in.",
    );
    setForm({ email: "", password: "", portal: form.portal });
    window.dispatchEvent(new CustomEvent("portal-profiles:refresh"));
  }

  return (
    <div className="card-elevated rounded-2xl p-6 lg:col-span-1">
      <div className="mb-4 flex items-center gap-2 text-primary">
        <ShieldCheck className="h-5 w-5" />
        <h2 className="text-lg font-bold">Create auth account</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
        Create secure portal accounts for users and assign access based on their role.
      </p>
      <form onSubmit={addStaff} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Portal
          </label>
          <select
            value={form.portal}
            onChange={(e) => setForm({ ...form, portal: e.target.value as PortalType })}
            className="w-full rounded-md border border-border bg-cream px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="library">{portalDisplayLabel("library")}</option>
            <option value="hostel">{portalDisplayLabel("hostel")}</option>
            <option value="fees">{portalDisplayLabel("fees")}</option>
            <option value="admin_1">{portalDisplayLabel("admin_1")}</option>
            <option value="admin_2">{portalDisplayLabel("admin_2")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="off"
            className="w-full rounded-md border border-border bg-cream px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Initial password
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            autoComplete="new-password"
            className="w-full rounded-md border border-border bg-cream px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Create
        </button>
      </form>
    </div>
  );
}

function CredentialList() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("portal_profiles")
      .select("user_id, portal, email, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows((data as ProfileRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const h = () => void load();
    window.addEventListener("portal-profiles:refresh", h);
    return () => window.removeEventListener("portal-profiles:refresh", h);
  }, []);

  async function removeProfile(userId: string) {
    if (
      !confirm(
        "Remove this portal assignment? The Auth user will remain until deleted in Supabase.",
      )
    )
      return;
    const { error } = await supabase.from("portal_profiles").delete().eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed");
    void load();
  }

  return (
    <div className="card-elevated rounded-2xl p-6 lg:col-span-2">
      <h2 className="mb-4 text-lg font-bold text-primary">Portal accounts ({rows.length})</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Portal</th>
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="px-2 py-2 font-medium">Added</th>
                <th className="px-2 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-border/60">
                  <td className="px-2 py-2">
                    <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-xs uppercase tracking-wider text-primary">
                      {portalDisplayLabel(r.portal)}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-medium text-primary">{r.email}</td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void removeProfile(r.user_id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
