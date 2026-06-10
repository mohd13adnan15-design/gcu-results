import { Outlet } from "react-router-dom";

import { AdminLayout } from "@/components/layout/AdminLayout";

export function AdminOutlet() {
  return (
    <AdminLayout
      requirePortal={["admin"]}
      title="Admin · Grade Card review"
      tagline="THE ARCHITECT OF ACCURACY. YOUR PRECISION BUILDS THE FOUNDATION OF EVERY STUDENT'S SUCCESS."
    >
      {() => <Outlet />}
    </AdminLayout>
  );
}
