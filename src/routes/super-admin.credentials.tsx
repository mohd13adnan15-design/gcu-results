import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import type { PortalType } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeft, Plus, ShieldCheck, Trash2 } from "lucide-react";

export const Route = createFileRoute("/super-admin/credentials")({
  head: () => ({ meta: [{ title: "Manage credentials — Super Admin" }] }),
  component: CredentialsPage,
});

interface Admin {
  id: string;
  username: string;
  password: string;
  portal: PortalType;
  created_at: string;
}

function CredentialsPage() {
  return (
    <AdminLayout
      requirePortal="super_admin"
      title="Manage Credentials"
      subtitle="Garden City University · Result Portal"
    >
      {() => (
        <div className="space-y-6">
          <Link
            to="/super-admin"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Super Admin
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
    username: "",
    password: "",
    portal: "faculty" as PortalType,
  });

  async function addAdmin(e: FormEvent) {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) return;
    const { error } = await supabase.from("portal_admins").insert({
      username: form.username.trim(),
      password: form.password,
      portal: form.portal,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Credential created");
    setForm({ username: "", password: "", portal: form.portal });
    window.dispatchEvent(new CustomEvent("portal-admins:refresh"));
  }

  return (
    <div className="card-elevated rounded-2xl p-6 lg:col-span-1">
      <div className="mb-4 flex items-center gap-2 text-primary">
        <ShieldCheck className="h-5 w-5" />
        <h2 className="text-lg font-bold">Create credential</h2>
      </div>
      <form onSubmit={addAdmin} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Portal
          </label>
          <select
            value={form.portal}
            onChange={(e) => setForm({ ...form, portal: e.target.value as PortalType })}
            className="w-full rounded-md border border-border bg-cream px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="library">Library</option>
            <option value="hostel">Hostel</option>
            <option value="fees">Academic Fees</option>
            <option value="faculty">Faculty</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Username
          </label>
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            className="w-full rounded-md border border-border bg-cream px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Password
          </label>
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
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
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("portal_admins").select("*").order("created_at");
    setAdmins((data as Admin[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const h = () => void load();
    window.addEventListener("portal-admins:refresh", h);
    return () => window.removeEventListener("portal-admins:refresh", h);
  }, []);

  async function deleteAdmin(id: string) {
    if (!confirm("Delete this admin credential?")) return;
    const { error } = await supabase.from("portal_admins").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    void load();
  }

  return (
    <div className="card-elevated rounded-2xl p-6 lg:col-span-2">
      <h2 className="mb-4 text-lg font-bold text-primary">All credentials ({admins.length})</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Portal</th>
                <th className="px-2 py-2 font-medium">Username</th>
                <th className="px-2 py-2 font-medium">Password</th>
                <th className="px-2 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="px-2 py-2">
                    <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-xs uppercase tracking-wider text-primary">
                      {a.portal}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-medium text-primary">{a.username}</td>
                  <td className="px-2 py-2 font-mono text-foreground">{a.password}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => void deleteAdmin(a.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
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
