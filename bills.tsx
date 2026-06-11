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
import { Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/bills")({ component: Bills });

const RECURRENCE = ["none", "weekly", "monthly", "yearly"];

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: z.coerce.number().positive().max(1_000_000),
  due_date: z.string().min(1),
  recurrence: z.string().min(1),
  notes: z.string().max(200).optional(),
});

function Bills() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: bills = [] } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*").order("due_date");
      if (error) throw error;
      return data;
    },
  });

  const addMut = useMutation({
    mutationFn: async (input: z.infer<typeof schema>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("bills").insert({ ...input, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bill added");
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["dashboard-bills"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_paid }: { id: string; is_paid: boolean }) => {
      const { error } = await supabase.from("bills").update({ is_paid }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["dashboard-bills"] });
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["dashboard-bills"] });
    },
  });

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: fd.get("name"),
      amount: fd.get("amount"),
      due_date: fd.get("due_date"),
      recurrence: fd.get("recurrence"),
      notes: fd.get("notes") || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    addMut.mutate(parsed.data);
  }

  const upcoming = bills.filter((b) => !b.is_paid);
  const paid = bills.filter((b) => b.is_paid);
  const today = format(new Date(), "yyyy-MM-dd");

  function statusBadge(b: typeof bills[number]) {
    if (b.is_paid) return <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Paid</span>;
    const days = differenceInDays(new Date(b.due_date), new Date(today));
    if (days < 0) return <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">Overdue {Math.abs(days)}d</span>;
    if (days <= 3) return <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning-foreground">Due in {days}d</span>;
    return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">In {days}d</span>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Bills</h1>
          <p className="text-sm text-muted-foreground">Stay on top of due dates.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Add bill</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New bill</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div><Label htmlFor="name">Name</Label><Input id="name" name="name" required maxLength={80} placeholder="Electricity" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="amount">Amount</Label><Input id="amount" name="amount" type="number" step="0.01" min="0" required /></div>
                <div><Label htmlFor="due_date">Due date</Label><Input id="due_date" name="due_date" type="date" required /></div>
              </div>
              <div>
                <Label htmlFor="recurrence">Recurrence</Label>
                <Select name="recurrence" defaultValue="monthly">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RECURRENCE.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="notes">Notes</Label><Input id="notes" name="notes" maxLength={200} /></div>
              <DialogFooter><Button type="submit" disabled={addMut.isPending}>{addMut.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Upcoming ({upcoming.length})</CardTitle></CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">All bills paid. 🎉</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">Due {format(new Date(b.due_date), "MMM d, yyyy")} · {b.recurrence}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(b)}
                    <span className="font-medium">${Number(b.amount).toFixed(2)}</span>
                    <Button size="sm" variant="outline" onClick={() => toggleMut.mutate({ id: b.id, is_paid: true })}>Mark paid</Button>
                    <Button variant="ghost" size="icon" onClick={() => delMut.mutate(b.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {paid.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Paid ({paid.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {paid.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(b.due_date), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">${Number(b.amount).toFixed(2)}</span>
                    <Button size="sm" variant="ghost" onClick={() => toggleMut.mutate({ id: b.id, is_paid: false })}>Undo</Button>
                    <Button variant="ghost" size="icon" onClick={() => delMut.mutate(b.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
