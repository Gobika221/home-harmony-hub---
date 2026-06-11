import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/expenses")({ component: Expenses });

const CATEGORIES = ["Groceries", "Utilities", "Rent", "Dining", "Transport", "Health", "Entertainment", "Other"];

const schema = z.object({
  amount: z.coerce.number().positive("Must be > 0").max(1_000_000),
  category: z.string().min(1).max(40),
  description: z.string().max(200).optional(),
  expense_date: z.string().min(1),
});

function Expenses() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMut = useMutation({
    mutationFn: async (input: z.infer<typeof schema>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("expenses").insert({ ...input, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense added");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard-expenses"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard-expenses"] });
    },
  });

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      amount: fd.get("amount"),
      category: fd.get("category"),
      description: fd.get("description") || undefined,
      expense_date: fd.get("expense_date"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    addMut.mutate(parsed.data);
  }

  const filtered = expenses.filter((e) => {
    if (filterCat !== "all" && e.category !== filterCat) return false;
    if (search && !(e.description?.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track what your household spends.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Add expense</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="amount">Amount</Label><Input id="amount" name="amount" type="number" step="0.01" min="0" required /></div>
                <div><Label htmlFor="expense_date">Date</Label><Input id="expense_date" name="expense_date" type="date" defaultValue={format(new Date(), "yyyy-MM-dd")} required /></div>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select name="category" defaultValue="Groceries">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="description">Description</Label><Input id="description" name="description" maxLength={200} /></div>
              <DialogFooter><Button type="submit" disabled={addMut.isPending}>{addMut.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">{filtered.length} entries · <span className="text-primary">${total.toFixed(2)}</span></CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No expenses yet. Add your first one.</p>
          ) : (
            <ul className="divide-y">
              {filtered.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex rounded-full bg-accent/20 px-2.5 py-1 text-xs font-medium">{e.category}</span>
                    <div>
                      <p className="font-medium">{e.description || e.category}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(e.expense_date), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">${Number(e.amount).toFixed(2)}</span>
                    <Button variant="ghost" size="icon" onClick={() => delMut.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
