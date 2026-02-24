import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Category, Entry } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Check, X, Layers } from "lucide-react";

const PRESET_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#84cc16"];

interface CategoriesProps {
  budgetId: number;
}

export default function CategoriesSection({ budgetId }: CategoriesProps) {
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newLimit, setNewLimit] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editLimit, setEditLimit] = useState("");

  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/budgets", budgetId, "categories"] });
  const { data: entries = [] } = useQuery<Entry[]>({ queryKey: ["/api/budgets", budgetId, "entries"] });

  const createCategory = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/categories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "categories"] });
      setShowNew(false);
      setNewName("");
      setNewLimit("");
      toast({ title: "Category created" });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/categories/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "categories"] });
      setEditingId(null);
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "categories"] });
      toast({ title: "Category deleted" });
    },
  });

  function getCategorySpending(categoryId: number) {
    return entries
      .filter(e => e.categoryId === categoryId && e.type === "expense")
      .reduce((sum, e) => sum + e.amount, 0);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wider">Categories</h2>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" data-testid="button-add-category">
              <Plus className="w-3 h-3 mr-0.5" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input placeholder="Category name" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="input-category-name" />
              <Input placeholder="Budget limit (optional)" type="number" step="0.01" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} data-testid="input-category-limit" />
              <div className="flex gap-1.5 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    className={`w-6 h-6 rounded-full border-2 ${newColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                    data-testid={`button-color-${c.replace('#', '')}`}
                  />
                ))}
              </div>
              <Button
                onClick={() => {
                  if (!newName) return;
                  createCategory.mutate({
                    name: newName,
                    color: newColor,
                    budgetLimit: newLimit ? parseFloat(newLimit) : null,
                    budgetId,
                    sortOrder: categories.length,
                  });
                }}
                className="w-full"
                disabled={!newName || createCategory.isPending}
                data-testid="button-create-category"
              >
                Create Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No categories. Add some to organize your expenses.</p>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => {
            const spent = getCategorySpending(cat.id);
            const hasLimit = cat.budgetLimit !== null && cat.budgetLimit !== undefined;
            const percent = hasLimit ? Math.min(100, (spent / cat.budgetLimit!) * 100) : 0;
            const isOver = hasLimit && spent > cat.budgetLimit!;

            if (editingId === cat.id) {
              return (
                <div key={cat.id} className="bg-muted/50 rounded-md p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 h-7 text-xs" />
                    <Input placeholder="Limit" type="number" value={editLimit} onChange={(e) => setEditLimit(e.target.value)} className="w-20 h-7 text-xs" />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex gap-1">
                      {PRESET_COLORS.slice(0, 6).map(c => (
                        <button
                          key={c}
                          className={`w-4 h-4 rounded-full border ${editColor === c ? "border-foreground" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setEditColor(c)}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                        updateCategory.mutate({ id: cat.id, data: { name: editName, color: editColor, budgetLimit: editLimit ? parseFloat(editLimit) : null } });
                      }} data-testid={`button-save-category-${cat.id}`}>
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-${cat.id}`}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={cat.id} className="group" data-testid={`category-item-${cat.id}`}>
                <div className="flex items-center gap-2 py-1">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm font-medium flex-1 truncate">{cat.name}</span>
                  {hasLimit && (
                    <span className={`text-xs tabular-nums ${isOver ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground"}`}>
                      ${spent.toFixed(0)} / ${cat.budgetLimit!.toFixed(0)}
                    </span>
                  )}
                  {!hasLimit && spent > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">${spent.toFixed(0)}</span>
                  )}
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color); setEditLimit(cat.budgetLimit?.toString() || ""); }}
                      className="min-w-[28px] min-h-[28px] flex items-center justify-center"
                      data-testid={`button-edit-category-${cat.id}`}
                    >
                      <Edit2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteCategory.mutate(cat.id)}
                      className="min-w-[28px] min-h-[28px] flex items-center justify-center"
                      data-testid={`button-delete-category-${cat.id}`}
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                {hasLimit && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
                    <div className={`h-full rounded-full ${isOver ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${percent}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
