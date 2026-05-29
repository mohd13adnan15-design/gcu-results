import { AdminLayout } from "@/components/layout/AdminLayout";
import { ClearanceAdminPage } from "@/features/admin/ClearanceAdminPage";

export function FeesPortalPage() {
  return (
    <AdminLayout
      requirePortal={["fees", "head_of_coe", "admin_1"]}
      title="Academic Fees Portal"
      tagline="CLEARING THE PATH. YOUR EFFICIENCY TRANSFORMS FINANCIAL MILESTONES INTO ACADEMIC VICTORIES."
      subtitle="Academic fees & clearance"
    >
      {() => <ClearanceAdminPage kind="fees" />}
    </AdminLayout>
  );
}
