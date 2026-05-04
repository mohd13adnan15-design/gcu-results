import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/super-admin")({
  head: () => ({ meta: [{ title: "Super Admin Portal — GCU" }] }),
  component: SuperAdminRoute,
});

function SuperAdminRoute() {
  return <Outlet />;
}
