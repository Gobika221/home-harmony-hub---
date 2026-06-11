import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ShoppingBasket } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/shopping")({ component: Shopping });

const listSchema = z.object({
  name: z.string().trim().min(1).max(60),
  estimated_budget: z.coerce.number().min(0).max(1_000_000).optional(),
});
const itemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().int().positive().max(10000),
  estimated_price: z.coerce.number().min(0).max(1_000_000).optional(),
});

function Shopping() {
  const qc = useQueryClient();
  const [listOpen, setListOpen] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);

  const { data: lists = [] } = useQuery({
    queryKey: ["shopping_lists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shopping_lists").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["shopping_items", activeListId],
    enabled: !!activeListId,
    queryFn: async () => {
      const { data, error } = await supabase.from("shopping_items").select("*").eq("list_id", activeListId!).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addListMut = useMutation({
    mutationFn: async (input: z.infer<typeof listSchema>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("shopping_lists").insert({
        name: input.name,
        estimated_budget: input.estimated_budget ?? null,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("List created");
      qc.invalidateQueries({ queryKey: ["shopping_lists"] });
      qc.invalidateQueries({ queryKey: ["dashboard-lists"] });
      setListOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delListMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      if (activeListId === id) setActiveListId(null);
      qc.invalidateQueries({ queryKey: ["shopping_lists"] });
      qc.invalidateQueries({ queryKey: ["dashboard-lists"] });
    },
  });

  const addItemMut = useMutation({
    mutationFn: async (input: z.infer<typeof itemSchema>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !activeListId) throw new Error("Pick a list");
      const { error } = await supabase.from("shopping_items").insert({
        name: input.name,
        quantity: input.quantity,
        estimated_price: input.estimated_price ?? null,
        user_id: user.id,
        list_id: activeListId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping_items", activeListId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const togItemMut = useMutation({
    mutationFn: async ({ id, is_purchased }: { id: string; is_purchased: boolean }) => {
      const { error } = await supabase.from("shopping_items").update({ is_purchased }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping_items", activeListId] }),
  });

  const delItemMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping_items", activeListId] }),
  });

  function handleAddList(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = listSchema.safeParse({
      name: fd.get("name"),
      estimated_budget: fd.get("estimated_budget") || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    addListMut.mutate(parsed.data);
  }

  function handleAddItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = itemSchema.safeParse({
      name: fd.get("name"),
      quantity: fd.get("quantity") || 1,
      estimated_price: fd.get("estimated_price") || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    addItemMut.mutate(parsed.data, { onSuccess: () => form.reset() });
  }

  const activeList = lists.find((l) => l.id === activeListId);
  const itemsTotal = items.reduce((s, i) => s + Number(i.estimated_price || 0) * i.quantity, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Shopping</h1>
          <p className="text-sm text-muted-foreground">Plan your trips with budgets.</p>
        </div>
        <Dialog open={listOpen} onOpenChange={setListOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> New list</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New shopping list</DialogTitle></DialogHeader>
            <form onSubmit={handleAddList} className="space-y-4">
              <div><Label htmlFor="name">Name</Label><Input id="name" name="name" required maxLength={60} placeholder="Weekly groceries" /></div>
              <div><Label htmlFor="estimated_budget">Estimated budget (optional)</Label><Input id="estimated_budget" name="estimated_budget" type="number" step="0.01" min="0" /></div>
              <DialogFooter><Button type="submit" disabled={addListMut.isPending}>{addListMut.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Your lists</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {lists.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No lists yet.</p>}
            {lists.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveListId(l.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${activeListId === l.id ? "bg-accent/30 font-medium" : "hover:bg-accent/15"}`}
              >
                <div>
                  <p>{l.name}</p>
                  {l.estimated_budget != null && <p className="text-xs text-muted-foreground">Budget ${Number(l.estimated_budget).toFixed(2)}</p>}
                </div>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); delListMut.mutate(l.id); }} />
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          {!activeList ? (
            <CardContent className="flex h-64 flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <ShoppingBasket className="mb-2 h-8 w-8" />
              Select a list to add items.
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{activeList.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Estimated total: ${itemsTotal.toFixed(2)}
                      {activeList.estimated_budget != null && ` / $${Number(activeList.estimated_budget).toFixed(2)} budget`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => delListMut.mutate(activeList.id)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete list</Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddItem} className="mb-4 flex gap-2">
                  <Input name="name" placeholder="Item name" required maxLength={80} />
                  <Input name="quantity" type="number" min="1" defaultValue="1" className="w-20" />
                  <Input name="estimated_price" type="number" step="0.01" min="0" placeholder="$" className="w-24" />
                  <Button type="submit"><Plus className="h-4 w-4" /></Button>
                </form>
                <ul className="divide-y">
                  {items.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">No items yet.</li>}
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2">
                      <Checkbox checked={i.is_purchased} onCheckedChange={(v) => togItemMut.mutate({ id: i.id, is_purchased: !!v })} />
                      <div className={`flex-1 ${i.is_purchased ? "line-through text-muted-foreground" : ""}`}>
                        <p className="text-sm font-medium">{i.name} <span className="text-xs text-muted-foreground">× {i.quantity}</span></p>
                      </div>
                      {i.estimated_price != null && <span className="text-sm">${(Number(i.estimated_price) * i.quantity).toFixed(2)}</span>}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delItemMut.mutate(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
