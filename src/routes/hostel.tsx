import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { ClearanceAdminPage } from "@/components/ClearanceAdminPage";

export const Route = createFileRoute("/hostel")({
  head: () => ({ meta: [{ title: "Hostel Portal — GCU" }] }),
  component: () => (
    <AdminLayout requirePortal="hostel" title="Hostel Portal" subtitle="Hostel fees & clearance">
      {() => <ClearanceAdminPage kind="hostel" />}
    </AdminLayout>
  ),
});
