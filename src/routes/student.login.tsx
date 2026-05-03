import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/student/login")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
