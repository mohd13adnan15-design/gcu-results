import { Outlet } from "react-router-dom";

import { AdminLayout } from "@/components/layout/AdminLayout";

export function FacultyLayout() {
  return (
    <AdminLayout
      requirePortal={["admin_2"]}
      title="Admin · Grade Card review"
      tagline="THE ARCHITECT OF ACCURACY. YOUR PRECISION BUILDS THE FOUNDATION OF EVERY STUDENT'S SUCCESS."
    >
      {() => <Outlet />}
    </AdminLayout>
  );
}
