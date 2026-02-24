import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Budget, EntryHistory } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format } from "date-fns";
import { History, Plus, Edit2, Trash2, Undo2, RotateCcw, ArrowRight } from "lucide-react";

export default function HistoryPage() {
  const { toast } = useToast();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });
  const budgetId = selectedBudgetId ? parseInt(selectedBudgetId) : budgets[0]?.id;

  const { data: history = [] } = useQuery<EntryHistory[]>({
    queryKey: ["/api/budgets", budgetId, "history"],
    enabled: !!budgetId,
  });

  const undoMutation = useMutation({
    mutationFn: async (historyId: number) => {
      const res = await apiRequest("POST", `/api/history/${historyId}/undo`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Change undone successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to undo", description: err.message, variant: "destructive" });
    },
  });

  function getActionIcon(action: string) {
    switch (action) {
      case "created": return <Plus className="w-3.5 h-3.5 text-emerald-600" />;
      case "updated": return <Edit2 className="w-3.5 h-3.5 text-blue-600" />;
      case "deleted": return <Trash2 className="w-3.5 h-3.5 text-red-600" />;
      case "restored": return <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />;
      case "reverted": return <Undo2 className="w-3.5 h-3.5 text-amber-600" />;
      default: return null;
    }
  }

  function getActionColor(action: string) {
    switch (action) {
      case "created": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400";
      case "updated": return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400";
      case "deleted": return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400";
      case "restored": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400";
      case "reverted": return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400";
      default: return "";
    }
  }

  function canUndo(action: string) {
    return action === "deleted" || action === "updated";
  }

  function parseEntryData(data: string | null) {
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (!budgetId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Create a budget first to see history.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold" data-testid="text-history-title">Change History</h1>
        </div>
        <Select value={selectedBudgetId || budgetId?.toString()} onValueChange={setSelectedBudgetId}>
          <SelectTrigger className="w-[160px]" data-testid="select-history-budget">
            <SelectValue placeholder="Select budget" />
          </SelectTrigger>
          <SelectContent>
            {budgets.map(b => (
              <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <History className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No changes recorded yet.</p>
          <p className="text-xs text-muted-foreground mt-1">All entry changes will be tracked here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(record => {
            const prevData = parseEntryData(record.previousData);
            const newData = parseEntryData(record.newData);
            const entryName = newData?.name || prevData?.name || `Entry #${record.entryId}`;
            const amount = newData?.amount || prevData?.amount;

            return (
              <div key={record.id} className="bg-card rounded-md border border-card-border px-4 py-3" data-testid={`history-record-${record.id}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    {getActionIcon(record.action)}
                    <span className="text-sm font-medium">{entryName}</span>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${getActionColor(record.action)}`}>
                      {record.action}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {canUndo(record.action) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={undoMutation.isPending}
                        onClick={() => undoMutation.mutate(record.id)}
                        data-testid={`button-undo-${record.id}`}
                      >
                        <Undo2 className="w-3 h-3 mr-1" />
                        Undo
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(record.timestamp), "MMM d, yyyy h:mm a")}
                    </span>
                  </div>
                </div>

                {record.action === "updated" && prevData && newData && (
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {prevData.amount !== newData.amount && (
                      <p className="flex items-center gap-1">
                        Amount: ${prevData.amount?.toFixed(2)} <ArrowRight className="w-3 h-3" /> ${newData.amount?.toFixed(2)}
                      </p>
                    )}
                    {prevData.name !== newData.name && (
                      <p className="flex items-center gap-1">
                        Name: {prevData.name} <ArrowRight className="w-3 h-3" /> {newData.name}
                      </p>
                    )}
                    {prevData.isPaidOrReceived !== newData.isPaidOrReceived && (
                      <p>Status: {newData.isPaidOrReceived ? "Marked as paid/received" : "Unmarked"}</p>
                    )}
                  </div>
                )}

                {amount && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Amount: ${amount.toFixed(2)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
