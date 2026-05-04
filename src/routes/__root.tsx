import { Outlet, Link, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster
        richColors
        position="top-right"
        closeButton
        toastOptions={{
          classNames: {
            closeButton:
              "h-6 w-6 border-0 bg-background/80 opacity-70 transition-opacity hover:opacity-100 [&>svg]:h-3.5 [&>svg]:w-3.5",
          },
          closeButtonAriaLabel: "Dismiss notification",
        }}
      />
    </>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});
