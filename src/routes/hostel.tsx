import { AdminLayout } from "@/components/layout/AdminLayout";
import { ClearanceAdminPage } from "@/features/admin/ClearanceAdminPage";

export function HostelPortalPage() {
  return (
    <AdminLayout 
      requirePortal={["hostel", "head_of_coe", "admin_1"]}
      title="Hostel Portal" 
      tagline="THE FINAL CLEARANCE. PROVIDING THE STABILITY NEEDED TO TRANSITION FROM CAMPUS TO CAREER."
      subtitle="Hostel fees & clearance"
    >
      {() => <ClearanceAdminPage kind="hostel" />}
    </AdminLayout>
  );
}
