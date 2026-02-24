import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tag } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Tag as TagIcon, Edit2, Check } from "lucide-react";

const PRESET_COLORS = ["#8b5cf6", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#84cc16"];

export default function ManageTagsPage() {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const { data: tags = [] } = useQuery<Tag[]>({ queryKey: ["/api/tags"] });

  const createTag = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tags", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setNewName("");
      toast({ title: "Tag created" });
    },
  });

  const updateTag = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/tags/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setEditingId(null);
      toast({ title: "Tag updated" });
    },
  });

  const deleteTag = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({ title: "Tag deleted" });
    },
  });

  function handleCreate() {
    if (!newName) return;
    createTag.mutate({ name: newName, color: newColor });
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }

  function handleUpdate() {
    if (!editingId || !editName) return;
    updateTag.mutate({ id: editingId, data: { name: editName, color: editColor } });
  }

  return (
    <div className="h-full overflow-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2">
        <TagIcon className="w-5 h-5 text-primary" />
        <h1 className="text-base sm:text-lg font-semibold" data-testid="text-tags-title">Manage Tags</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Tags let you label entries with custom markers like "tax deductible", "reimbursable", or "impulse buy" for flexible filtering.
      </p>

      <div className="bg-card rounded-md border border-card-border p-3 sm:p-4 space-y-3">
        <h2 className="text-sm font-semibold">Create Tag</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Tag name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
            data-testid="input-new-tag-name"
          />
          <Button onClick={handleCreate} disabled={!newName || createTag.isPending} data-testid="button-create-tag">
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full border-2 transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              onClick={() => setNewColor(c)}
            />
          ))}
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <TagIcon className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No tags created yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Common tags: tax deductible, reimbursable, impulse buy, essential, optional</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map(tag => (
            <div key={tag.id} className="flex items-center gap-2 sm:gap-3 bg-card rounded-md border border-card-border px-3 sm:px-4 py-2.5 sm:py-3" data-testid={`tag-item-${tag.id}`}>
              {editingId === tag.id ? (
                <>
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: editColor }} />
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    data-testid={`input-edit-tag-${tag.id}`}
                  />
                  <div className="flex gap-1 flex-wrap">
                    {PRESET_COLORS.slice(0, 5).map(c => (
                      <button
                        key={c}
                        className={`w-5 h-5 sm:w-4 sm:h-4 rounded-full border ${editColor === c ? "border-foreground" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setEditColor(c)}
                      />
                    ))}
                  </div>
                  <Button size="icon" variant="ghost" onClick={handleUpdate} data-testid={`button-save-tag-${tag.id}`}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-medium flex-1 truncate">{tag.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(tag)} data-testid={`button-edit-tag-${tag.id}`}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteTag.mutate(tag.id)} data-testid={`button-delete-tag-${tag.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
