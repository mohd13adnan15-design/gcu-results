import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  FileCheck2,
  ShieldCheck,
  Sparkles,
  Clock,
  Globe,
  LockKeyhole,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GCU Result Portal — Garden City University" },
      {
        name: "description",
        content:
          "Sign in to access your clearance status and download your official marks card at Garden City University.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: FileCheck2,
    title: "Instant Marks Card",
    description:
      "Generate and download your official marks card the moment your clearance completes — no waiting at the office.",
  },
  {
    icon: ShieldCheck,
    title: "Verified Clearance",
    description:
      "End-to-end clearance verification ensures every dues check is approved by the right authority before issuance.",
  },
  {
    icon: Clock,
    title: "Real-time Status",
    description:
      "Live status updates the second your dues are settled, so you always know exactly where you stand.",
  },
  {
    icon: LockKeyhole,
    title: "Secure Sign-in",
    description:
      "Role-aware authentication routes you to the right workspace automatically — only what you need, nothing more.",
  },
  {
    icon: Globe,
    title: "Anywhere Access",
    description:
      "Fully responsive — pick up where you left off on a phone, tablet or desktop, with the same experience.",
  },
  {
    icon: Sparkles,
    title: "One Unified Workspace",
    description:
      "Every step of your result journey lives in one place, replacing scattered counters and queues with a single dashboard.",
  },
] as const;

function Landing() {
  return (
    <div className="min-h-screen bg-grain">
      {/* Header */}
      <header className="border-b border-border bg-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <img
              src="/gcu-logo.png"
              alt="Garden City University"
              className="h-11 w-11 rounded-md object-cover"
            />
            <div className="leading-tight">
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Garden City University
              </p>
              <h1 className="text-xl font-bold text-primary">Result Portal</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-4xl md:text-6xl font-bold leading-tight text-primary">
              Your clearance.
              <br />
              Your marks card.
              <br />
              One sign-in.
            </h2>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              A single, secure entry point to your result journey. Sign in with your credentials and
              we'll take you exactly where you need to be.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:opacity-90"
              >
                Sign In <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Hero visual: stacked feature highlight cards */}
          <div className="relative">
            <div className="card-elevated rounded-2xl p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent">
                  <FileCheck2 className="h-6 w-6 text-primary" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Marks Card Ready
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-primary">Cleared & Verified</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    All dues settled — your official marks card is one click away.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-secondary px-3 py-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-semibold text-primary">Live</p>
                </div>
                <div className="rounded-xl bg-secondary px-3 py-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Access</p>
                  <p className="mt-1 text-sm font-semibold text-primary">24 / 7</p>
                </div>
                <div className="rounded-xl bg-secondary px-3 py-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Auth</p>
                  <p className="mt-1 text-sm font-semibold text-primary">Secure</p>
                </div>
              </div>
            </div>

            {/* Decorative blob */}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-8 -right-6 h-40 w-40 rounded-full bg-accent/40 blur-3xl"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-cream/60">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-muted-foreground">
              What you get
            </p>
            <h3 className="text-3xl md:text-4xl font-bold text-primary">
              Built for a faster, calmer end-of-semester
            </h3>
            <p className="mt-3 text-base text-muted-foreground">
              No more counter-hopping or paper trails. Every feature is designed to get you from
              "submitted" to "downloaded" with as few clicks as possible.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="card-elevated flex flex-col gap-3 rounded-2xl p-6 transition hover:-translate-y-0.5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                </div>
                <h4 className="text-lg font-semibold text-primary">{title}</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sign-in CTA */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="card-elevated flex flex-col items-start gap-6 rounded-2xl p-8 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-xl">
            <h3 className="text-2xl md:text-3xl font-bold text-primary">Ready to continue?</h3>
            <p className="mt-2 text-base text-muted-foreground">
              Sign in with your university credentials and we'll take you straight to your
              workspace.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:opacity-90"
          >
            Sign In <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border bg-cream/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-center">
          <img
            src="/gcu-logo.png"
            alt="Garden City University"
            className="h-10 w-10 rounded-md object-cover"
          />
          <p className="text-sm font-semibold text-primary">Garden City University</p>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Result Portal · Bengaluru, India
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Garden City University. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
