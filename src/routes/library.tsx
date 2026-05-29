import { AdminLayout } from "@/components/layout/AdminLayout";
import { ClearanceAdminPage } from "@/features/admin/ClearanceAdminPage";

export function LibraryPortalPage() {
  return (
    <AdminLayout 
      requirePortal={["library", "head_of_coe", "admin_1"]}
      title="Library Portal" 
      tagline="HONORING THE RESOURCE. ENSURING EVERY KNOWLEDGE ASSET IS ACCOUNTED FOR AND VALUED."
      subtitle="Book returns & clearance"
    >
      {() => <ClearanceAdminPage kind="library" />}
    </AdminLayout>
  );
}
