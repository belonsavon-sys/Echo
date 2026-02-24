import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Budget } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Plus, BarChart3, Calendar, Target, FlaskConical, History, Tag, FolderOpen, Trash2, Settings } from "lucide-react";
import { format } from "date-fns";

interface AppSidebarProps {
  activeBudgetId: number | null;
  activeView: string;
  onSelectBudget: (id: number) => void;
  onSelectView: (view: string) => void;
}

export function AppSidebar({ activeBudgetId, activeView, onSelectBudget, onSelectView }: AppSidebarProps) {
  const [showNewBudget, setShowNewBudget] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState("");
  const [newBudgetPeriod, setNewBudgetPeriod] = useState("monthly");

  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });

  const createBudget = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/budgets", data);
      return res.json();
    },
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setShowNewBudget(false);
      setNewBudgetName("");
      onSelectBudget(budget.id);
    },
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/budgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
    },
  });

  function handleCreateBudget() {
    if (!newBudgetName) return;
    createBudget.mutate({
      name: newBudgetName,
      period: newBudgetPeriod,
      startDate: format(new Date(), "yyyy-MM-dd"),
      isActive: true,
      sortOrder: budgets.length,
    });
  }

  const navItems = [
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "annual", label: "Annual Overview", icon: Calendar },
    { id: "goals", label: "Savings Goals", icon: Target },
    { id: "whatif", label: "What If", icon: FlaskConical },
    { id: "history", label: "History", icon: History },
    { id: "tags", label: "Manage Tags", icon: Tag },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          <span className="text-base font-bold tracking-tight">Fudget</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between gap-1">
            <span>Budgets</span>
            <Dialog open={showNewBudget} onOpenChange={setShowNewBudget}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-5 w-5" data-testid="button-new-budget">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Budget</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <Input
                    placeholder="Budget name"
                    value={newBudgetName}
                    onChange={(e) => setNewBudgetName(e.target.value)}
                    data-testid="input-new-budget-name"
                  />
                  <Select value={newBudgetPeriod} onValueChange={setNewBudgetPeriod}>
                    <SelectTrigger data-testid="select-budget-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleCreateBudget}
                    className="w-full"
                    disabled={!newBudgetName || createBudget.isPending}
                    data-testid="button-create-budget"
                  >
                    {createBudget.isPending ? "Creating..." : "Create Budget"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {budgets.map((budget) => (
                <SidebarMenuItem key={budget.id}>
                  <SidebarMenuButton
                    onClick={() => onSelectBudget(budget.id)}
                    data-active={activeBudgetId === budget.id && activeView === "budget"}
                    data-testid={`button-budget-${budget.id}`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span className="flex-1 truncate">{budget.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBudget.mutate(budget.id);
                      }}
                      className="invisible group-hover/menu-item:visible"
                      data-testid={`button-delete-budget-${budget.id}`}
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {budgets.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">No budgets yet. Create one to get started.</p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onSelectView(item.id)}
                    data-active={activeView === item.id}
                    data-testid={`button-nav-${item.id}`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-2">
        <p className="text-[10px] text-muted-foreground text-center">Simple Budget Tracking</p>
      </SidebarFooter>
    </Sidebar>
  );
}
