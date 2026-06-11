import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Receipt, ListChecks, ShoppingBasket, ArrowRight, AlertCircle } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, startOfMonth, endOfMonth, addDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Dashboard() {
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const upcomingEnd = format(addDays(now, 14), "yyyy-MM-dd");
  const today = format(now, "yyyy-MM-dd");

  const { data: expenses = [] } = useQuery({
    queryKey: ["dashboard-expenses", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses")
        .select("amount, category, expense_date")
        .gte("expense_date", monthStart).lte("expense_date", monthEnd);
      if (error) throw error;
      return data;
    },
  });
  const { data: bills = [] } = useQuery({
    queryKey: ["dashboard-bills", today],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills")
        .select("id, name, amount, due_date, is_paid")
        .eq("is_paid", false).lte("due_date", upcomingEnd).order("due_date");
      if (error) throw error;
      return data;
    },
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["dashboard-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks")
        .select("status").neq("status", "done");
      if (error) throw error;
      return data;
    },
  });
  const { data: lists = [] } = useQuery({
    queryKey: ["dashboard-lists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shopping_lists").select("id");
      if (error) throw error;
      return data;
    },
  });

  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const upcomingTotal = bills.reduce((s, b) => s + Number(b.amount), 0);

  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const byDay = Array.from({ length: 14 }, (_, i) => {
    const d = format(addDays(now, i - 13), "MMM dd");
    const day = format(addDays(now, i - 13), "yyyy-MM-dd");
    const total = expenses.filter((e) => e.expense_date === day).reduce((s, e) => s + Number(e.amount), 0);
    return { day: d, total };
  });

  const stats = [
    { label: "This month", value: `$${totalSpent.toFixed(2)}`, icon: Wallet, to: "/expenses" as const, hint: `${expenses.length} expenses` },
    { label: "Upcoming bills", value: `$${upcomingTotal.toFixed(2)}`, icon: Receipt, to: "/bills" as const, hint: `${bills.length} due in 14 days` },
    { label: "Open tasks", value: `${tasks.length}`, icon: ListChecks, to: "/tasks" as const, hint: "not yet done" },
    { label: "Shopping lists", value: `${lists.length}`, icon: ShoppingBasket, to: "/shopping" as const, hint: "active lists" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Welcome home</h1>
        <p className="text-sm text-muted-foreground">{format(now, "EEEE, MMMM d")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="group">
            <Card className="transition hover:border-primary/50 hover:shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="mt-1 font-display text-2xl font-semibold">{s.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20">
                    <s.icon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Spending — last 14 days</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">By category</CardTitle></CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No expenses this month yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                      {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Upcoming bills</CardTitle>
          <Link to="/bills" className="text-xs text-muted-foreground hover:text-foreground">View all <ArrowRight className="ml-1 inline h-3 w-3" /></Link>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing due soon. 🎉</p>
          ) : (
            <ul className="divide-y">
              {bills.slice(0, 5).map((b) => {
                const overdue = b.due_date < today;
                return (
                  <li key={b.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      {overdue && <AlertCircle className="h-4 w-4 text-destructive" />}
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {format(new Date(b.due_date), "MMM d")}
                          {overdue && <span className="ml-2 text-destructive">overdue</span>}
                        </p>
                      </div>
                    </div>
                    <span className="font-medium">${Number(b.amount).toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
