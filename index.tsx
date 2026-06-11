import { createFileRoute, Link } from "@tanstack/react-router";
import { Home, Wallet, ListChecks, ShoppingBasket, Bell } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hearth — Household Management Made Calm" },
      { name: "description", content: "Track expenses, bills, tasks and shopping lists for your whole household in one warm, organized dashboard." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Wallet, title: "Expenses & Budgets", desc: "Log spending, categorize, set monthly budgets." },
  { icon: Bell, title: "Bills & Reminders", desc: "Never miss a due date with upcoming-bill alerts." },
  { icon: ListChecks, title: "Tasks", desc: "Assign chores with priorities and deadlines." },
  { icon: ShoppingBasket, title: "Shopping Lists", desc: "Plan trips with estimated budgets per list." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Home className="h-5 w-5" />
          </div>
          <span className="text-lg font-display font-semibold">Hearth</span>
        </div>
        <Link to="/auth" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <span className="inline-flex rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              For households that want calm, not chaos
            </span>
            <h1 className="mt-5 text-5xl font-display font-semibold leading-[1.05] md:text-6xl">
              The warm home for your <span className="text-primary">household</span> life.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Hearth keeps expenses, bills, tasks, and shopping in one organized place — so your family always knows what's next.
            </p>
            <div className="mt-8 flex gap-3">
              <Link to="/auth" className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">
                Get started — it's free
              </Link>
              <Link to="/auth" className="rounded-full border bg-card px-6 py-3 text-sm font-medium hover:bg-accent/20">
                I already have an account
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/20 to-warning/20 blur-2xl" />
            <div className="relative rounded-3xl border bg-card p-6 shadow-xl">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="text-xs text-muted-foreground">This month</p>
                  <p className="text-2xl font-display font-semibold">$1,842.50</p>
                </div>
                <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">On budget</span>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  { k: "Groceries", v: "$420", c: "bg-chart-1" },
                  { k: "Utilities", v: "$215", c: "bg-chart-2" },
                  { k: "Rent", v: "$1,000", c: "bg-chart-3" },
                  { k: "Dining", v: "$207", c: "bg-chart-4" },
                ].map((r) => (
                  <div key={r.k} className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${r.c}`} />
                    <span className="flex-1 text-sm">{r.k}</span>
                    <span className="text-sm font-medium">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
