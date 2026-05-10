import { Outlet } from "react-router-dom";

import { AdminLayout } from "@/components/layout/AdminLayout";

export function FacultyLayout() {
  return (
    <AdminLayout
      requirePortal="admin_1"
      title="Verification 2 · Marksheet review"
      tagline="THE ARCHITECT OF ACCURACY. YOUR PRECISION BUILDS THE FOUNDATION OF EVERY STUDENT'S SUCCESS."
      subtitle="Review and verify submitted marksheets"
    >
      {() => <Outlet />}
    </AdminLayout>
  );
}
