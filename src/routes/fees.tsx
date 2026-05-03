import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { ClearanceAdminPage } from "@/components/ClearanceAdminPage";

export const Route = createFileRoute("/fees")({
  head: () => ({ meta: [{ title: "Academic Fees Portal — GCU" }] }),
  component: () => (
    <AdminLayout
      requirePortal="fees"
      title="Academic Fees Portal"
      subtitle="Academic fees & clearance"
    >
      {() => <ClearanceAdminPage kind="fees" />}
    </AdminLayout>
  ),
});
