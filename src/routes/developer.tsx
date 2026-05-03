import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/developer")({
  beforeLoad: () => {
    throw redirect({ to: "/super-admin" });
  },
});
