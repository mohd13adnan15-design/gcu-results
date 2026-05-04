import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AdminLayout } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Portal — GCU" }] }),
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  return (
    <AdminLayout
      requirePortal="admin"
      title="Admin Portal"
      subtitle="Full verification dashboard"
    >
      {() => <Outlet />}
    </AdminLayout>
  );
}
