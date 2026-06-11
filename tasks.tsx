import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/tasks")({ component: Tasks });

const PRIORITIES = ["low", "medium", "high"] as const;
const STATUSES = ["todo", "in_progress", "done"] as const;

const schema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUSES),
  due_date: z.string().optional(),
  assigned_to: z.string().max(60).optional(),
});

function Tasks() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMut = useMutation({
    mutationFn: async (input: z.infer<typeof schema>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("tasks").insert({
        ...input,
        user_id: user.id,
        due_date: input.due_date || null,
        assigned_to: input.assigned_to || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task created");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tasks"] });
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tasks"] });
    },
  });

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      title: fd.get("title"),
      description: fd.get("description") || undefined,
      priority: fd.get("priority"),
      status: fd.get("status"),
      due_date: fd.get("due_date") || undefined,
      assigned_to: fd.get("assigned_to") || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    addMut.mutate(parsed.data);
  }

  function priorityChip(p: string) {
    const map: Record<string, string> = {
      low: "bg-muted text-muted-foreground",
      medium: "bg-accent/20 text-accent-foreground",
      high: "bg-destructive/15 text-destructive",
    };
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[p] || ""}`}>{p}</span>;
  }

  const columns = STATUSES.map((s) => ({ status: s, items: tasks.filter((t) => t.status === s) }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Household chores, organized.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Add task</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div><Label htmlFor="title">Title</Label><Input id="title" name="title" required maxLength={100} /></div>
              <div><Label htmlFor="description">Description</Label><Textarea id="description" name="description" maxLength={500} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue="todo">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="due_date">Due date</Label><Input id="due_date" name="due_date" type="date" /></div>
                <div><Label htmlFor="assigned_to">Assigned to</Label><Input id="assigned_to" name="assigned_to" maxLength={60} placeholder="Anyone" /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={addMut.isPending}>{addMut.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {columns.map((col) => (
          <Card key={col.status}>
            <CardHeader>
              <CardTitle className="text-sm capitalize text-muted-foreground">
                {col.status.replace("_", " ")} <span className="ml-1 text-foreground">({col.items.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {col.items.length === 0 && <p className="py-2 text-xs text-muted-foreground">No tasks.</p>}
              {col.items.map((t) => (
                <div key={t.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-tight">{t.title}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delMut.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  {t.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {priorityChip(t.priority)}
                    {t.due_date && <span>Due {format(new Date(t.due_date), "MMM d")}</span>}
                    {t.assigned_to && <span>· {t.assigned_to}</span>}
                  </div>
                  <Select value={t.status} onValueChange={(v) => updMut.mutate({ id: t.id, status: v })}>
                    <SelectTrigger className="mt-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
