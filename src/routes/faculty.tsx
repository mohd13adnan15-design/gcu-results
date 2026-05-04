import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AdminLayout } from "@/components/AdminLayout";

export const Route = createFileRoute("/faculty")({
  head: () => ({ meta: [{ title: "Faculty Portal — GCU" }] }),
  component: FacultyLayout,
});

function FacultyLayout() {
  return (
    <AdminLayout
      requirePortal="faculty"
      title="Faculty Portal"
      subtitle="Review and verify marksheets"
    >
      {() => <Outlet />}
    </AdminLayout>
  );
}
