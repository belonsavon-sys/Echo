import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SavingsGoal, Budget } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Target, Trash2, CalendarIcon, TrendingUp } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

export default function SavingsGoalsPage() {
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [color, setColor] = useState("#10b981");
  const [budgetIdStr, setBudgetIdStr] = useState<string>("");
  const [addAmount, setAddAmount] = useState<Record<number, string>>({});

  const { data: goals = [] } = useQuery<SavingsGoal[]>({ queryKey: ["/api/savings-goals"] });
  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });

  const createGoal = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/savings-goals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });
      setShowNew(false);
      setName("");
      setTarget("");
      setCurrent("");
      setDeadline(undefined);
      toast({ title: "Savings goal created" });
    },
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/savings-goals/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/savings-goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });
      toast({ title: "Goal deleted" });
    },
  });

  function handleCreate() {
    if (!name || !target) return;
    createGoal.mutate({
      name,
      targetAmount: parseFloat(target),
      currentAmount: current ? parseFloat(current) : 0,
      deadline: deadline ? format(deadline, "yyyy-MM-dd") : null,
      color,
      budgetId: budgetIdStr ? parseInt(budgetIdStr) : null,
    });
  }

  function handleAddFunds(goalId: number, currentAmount: number) {
    const amount = parseFloat(addAmount[goalId] || "0");
    if (amount <= 0) return;
    updateGoal.mutate({ id: goalId, data: { currentAmount: currentAmount + amount } });
    setAddAmount(prev => ({ ...prev, [goalId]: "" }));
    toast({ title: `$${amount.toFixed(2)} added to goal` });
  }

  const PRESET_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

  return (
    <div className="h-full overflow-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-base sm:text-lg font-semibold" data-testid="text-goals-title">Savings Goals</h1>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-goal">
              <Plus className="w-4 h-4 mr-1" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Savings Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input placeholder="Goal name (e.g., Vacation Fund)" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-goal-name" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Target amount" type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} data-testid="input-goal-target" />
                <Input placeholder="Current amount" type="number" step="0.01" value={current} onChange={(e) => setCurrent(e.target.value)} data-testid="input-goal-current" />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start" data-testid="button-goal-deadline">
                    <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                    {deadline ? format(deadline, "MMM d, yyyy") : "Set deadline (optional)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={deadline} onSelect={setDeadline} />
                </PopoverContent>
              </Popover>
              <div className="flex gap-1.5 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              {budgets.length > 0 && (
                <Select value={budgetIdStr} onValueChange={setBudgetIdStr}>
                  <SelectTrigger data-testid="select-goal-budget">
                    <SelectValue placeholder="Link to budget (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No budget</SelectItem>
                    {budgets.map(b => (
                      <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={handleCreate} className="w-full" disabled={!name || !target || createGoal.isPending} data-testid="button-create-goal">
                {createGoal.isPending ? "Creating..." : "Create Goal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No savings goals yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Create a goal to start tracking your savings progress.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {goals.map(goal => {
            const percent = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
            const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
            const daysLeft = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;
            const isComplete = goal.currentAmount >= goal.targetAmount;

            return (
              <div key={goal.id} className="bg-card rounded-md border border-card-border p-3 sm:p-4 space-y-3" data-testid={`card-goal-${goal.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: goal.color }} />
                    <h3 className="text-sm font-semibold truncate">{goal.name}</h3>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteGoal.mutate(goal.id)} data-testid={`button-delete-goal-${goal.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">${goal.currentAmount.toFixed(2)}</span>
                    <span className="font-medium">${goal.targetAmount.toFixed(2)}</span>
                  </div>
                  <Progress value={percent} className="h-3" />
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{percent.toFixed(0)}% complete</span>
                    {isComplete ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Goal reached!</span>
                    ) : (
                      <span>${remaining.toFixed(2)} remaining</span>
                    )}
                  </div>
                  {daysLeft !== null && daysLeft > 0 && !isComplete && (
                    <p className="text-xs text-muted-foreground">{daysLeft} days left</p>
                  )}
                </div>

                {!isComplete && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Amount"
                      type="number"
                      step="0.01"
                      value={addAmount[goal.id] || ""}
                      onChange={(e) => setAddAmount(prev => ({ ...prev, [goal.id]: e.target.value }))}
                      className="flex-1"
                      data-testid={`input-add-funds-${goal.id}`}
                    />
                    <Button size="sm" onClick={() => handleAddFunds(goal.id, goal.currentAmount)} data-testid={`button-add-funds-${goal.id}`}>
                      <TrendingUp className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
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
