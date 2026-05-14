import { Outlet } from "react-router-dom";

import { AdminLayout } from "@/components/layout/AdminLayout";

export function AdminLayoutRoute() {
  return (
    <AdminLayout
      requirePortal="admin_2"
      title="Admin · Final verification"
      tagline="THE GUARDIAN OF INTEGRITY. YOUR DILIGENCE ENSURES EXCELLENCE IN EVERY GRADECARD ISSUED."
      subtitle="Full verification dashboard"
    >
      {() => <Outlet />}
    </AdminLayout>
  );
}
