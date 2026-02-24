import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Favorite } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Edit2, X, Star } from "lucide-react";

export default function FavoritesPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingFavorite, setEditingFavorite] = useState<Favorite | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");

  const { data: favorites = [], isLoading } = useQuery<Favorite[]>({ queryKey: ["/api/favorites"] });

  const createFavorite = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/favorites", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      resetForm();
      toast({ title: "Favorite added" });
    },
  });

  const updateFavorite = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/favorites/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      resetForm();
      toast({ title: "Favorite updated" });
    },
  });

  const deleteFavorite = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/favorites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      toast({ title: "Favorite deleted" });
    },
  });

  function resetForm() {
    setName("");
    setAmount("");
    setType("expense");
    setEditingFavorite(null);
    setShowForm(false);
  }

  function startEdit(fav: Favorite) {
    setEditingFavorite(fav);
    setName(fav.name);
    setAmount(fav.amount.toString());
    setType(fav.type as "income" | "expense");
    setShowForm(true);
  }

  function handleSubmit() {
    if (!name || !amount) return;
    const data = {
      name,
      amount: parseFloat(amount),
      type,
      categoryId: null,
      tagIds: null,
      note: null,
    };

    if (editingFavorite) {
      updateFavorite.mutate({ id: editingFavorite.id, data });
    } else {
      createFavorite.mutate(data);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 sm:px-4 py-3 border-b flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" />
          <h1 className="text-base sm:text-lg font-semibold" data-testid="text-favorites-title">Favorites</h1>
        </div>
        <span className="text-xs text-muted-foreground">{favorites.length} templates</span>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-2">
          {favorites.length === 0 ? (
            <div className="text-center py-8">
              <Star className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No favorites yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create templates for entries you add frequently</p>
            </div>
          ) : (
            favorites.map((fav) => {
              const isIncome = fav.type === "income";
              return (
                <div
                  key={fav.id}
                  data-testid={`favorite-item-${fav.id}`}
                  className="flex items-center gap-2 px-3 py-2.5 group hover-elevate rounded-md"
                >
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium truncate" data-testid={`text-favorite-name-${fav.id}`}>
                        {fav.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${isIncome ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
                      >
                        {fav.type}
                      </Badge>
                    </div>
                  </div>

                  <span
                    className={`text-sm font-semibold tabular-nums shrink-0 ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                    data-testid={`text-favorite-amount-${fav.id}`}
                  >
                    {isIncome ? "+" : "-"}${fav.amount.toFixed(2)}
                  </span>

                  <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(fav)} data-testid={`button-edit-favorite-${fav.id}`}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteFavorite.mutate(fav.id)} data-testid={`button-delete-favorite-${fav.id}`}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showForm ? (
        <div className="border-t px-3 sm:px-4 py-3 sm:py-4 bg-card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{editingFavorite ? "Edit Favorite" : "Add Favorite"}</h3>
            <Button size="icon" variant="ghost" onClick={resetForm} data-testid="button-cancel-favorite">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={type === "income" ? "default" : "outline"}
              onClick={() => setType("income")}
              className={type === "income" ? "bg-emerald-600 text-white" : ""}
              data-testid="button-favorite-type-income"
            >
              Income
            </Button>
            <Button
              size="sm"
              variant={type === "expense" ? "default" : "outline"}
              onClick={() => setType("expense")}
              className={type === "expense" ? "bg-red-600 text-white" : ""}
              data-testid="button-favorite-type-expense"
            >
              Expense
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-favorite-name"
            />
            <Input
              placeholder="Amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-favorite-amount"
            />
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={!name || !amount || createFavorite.isPending || updateFavorite.isPending}
            data-testid="button-submit-favorite"
          >
            {createFavorite.isPending || updateFavorite.isPending ? "Saving..." : editingFavorite ? "Update" : "Add Favorite"}
          </Button>
        </div>
      ) : (
        <div className="border-t p-3">
          <Button onClick={() => setShowForm(true)} className="w-full" data-testid="button-add-favorite">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Favorite
          </Button>
        </div>
      )}
    </div>
  );
}
