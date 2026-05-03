import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/AdminLayout";
import { ClearanceAdminPage } from "@/components/ClearanceAdminPage";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Library Portal — GCU" }] }),
  component: () => (
    <AdminLayout requirePortal="library" title="Library Portal" subtitle="Book returns & clearance">
      {() => <ClearanceAdminPage kind="library" />}
    </AdminLayout>
  ),
});
