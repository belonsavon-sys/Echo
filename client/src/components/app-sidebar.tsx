import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Budget, NavigationPreferences, InsertBudget } from "@shared/schema";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch as SwitchComponent } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import {
  Wallet, Plus, BarChart3, Calendar, Target, FlaskConical, History,
  Tag, FolderOpen, Folder, Sun, Moon, LayoutDashboard, Star, Landmark,
  ArrowLeftRight, LogOut, MoreHorizontal, ChevronDown, Settings2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { CURRENCIES } from "@/lib/currency";

interface AppSidebarProps {
  activeBudgetId: number | null;
  activeView: string;
  onSelectBudget: (id: number) => void;
  onSelectView: (view: string) => void;
}

const YEAR_FOLDER_PATTERN = /^\d{4}$/;
type BudgetPayload = Omit<InsertBudget, "userId">;

export function AppSidebar({ activeBudgetId, activeView, onSelectBudget, onSelectView }: AppSidebarProps) {
  const { user, logout, isLoggingOut } = useAuth();
  const { darkMode, setDarkMode, theme, setTheme, themes } = useTheme();
  const [showNewBudget, setShowNewBudget] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState("");
  const [newBudgetPeriod, setNewBudgetPeriod] = useState("monthly");
  const [newBudgetIsFolder, setNewBudgetIsFolder] = useState(false);
  const [newBudgetParentId, setNewBudgetParentId] = useState<string>("none");
  const [newBudgetCurrency, setNewBudgetCurrency] = useState("USD");
  const [newBudgetOpeningBalance, setNewBudgetOpeningBalance] = useState("0");

  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneSourceBudget, setCloneSourceBudget] = useState<Budget | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneParentId, setCloneParentId] = useState<string>("none");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);
  const [showNavigationSettings, setShowNavigationSettings] = useState(false);

  const [folderOpenState, setFolderOpenState] = useState<Record<number, boolean>>({});
  const [navigationState, setNavigationState] = useState<NavigationPreferences>({
    hiddenToolIds: [],
    moreExpanded: false,
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const convertedYearBudgetIdsRef = useRef<Set<number>>(new Set());
  const convertingYearBudgetIdsRef = useRef<Set<number>>(new Set());
  const didInitMoreOpenRef = useRef(false);

  const { data: budgets = [] } = useQuery<Budget[]>({ queryKey: ["/api/budgets"] });
  const { data: navigationPreferences } = useQuery<NavigationPreferences>({
    queryKey: ["/api/user-preferences/navigation"],
  });

  const getChildBudgets = (parentId: number | null) =>
    budgets
      .filter((b) => (b.parentId ?? null) === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  function getFolderOptions(parentId: number | null = null, depth = 0): Array<{ id: number; name: string; depth: number }> {
    const items = getChildBudgets(parentId).filter((b) => b.isFolder);
    const options: Array<{ id: number; name: string; depth: number }> = [];
    for (const folder of items) {
      options.push({ id: folder.id, name: folder.name, depth });
      options.push(...getFolderOptions(folder.id, depth + 1));
    }
    return options;
  }

  const folderOptions = getFolderOptions();
  const rootBudgets = getChildBudgets(null);

  const isFolderOpen = (id: number) => folderOpenState[id] !== false;

  useEffect(() => {
    const yearCandidates = budgets.filter(
      (b) => !b.parentId && YEAR_FOLDER_PATTERN.test(b.name),
    );
    const pending = yearCandidates.filter(
      (b) =>
        !convertedYearBudgetIdsRef.current.has(b.id) &&
        !convertingYearBudgetIdsRef.current.has(b.id),
    );
    if (pending.length === 0) return;

    let cancelled = false;
    let changed = false;
    (async () => {
      for (const budget of pending) {
        convertingYearBudgetIdsRef.current.add(budget.id);
        try {
          await apiRequest("POST", `/api/budgets/${budget.id}/convert-to-year-folder`);
          convertedYearBudgetIdsRef.current.add(budget.id);
          changed = true;
        } catch {
          // Ignore; budget remains usable even if conversion fails.
        } finally {
          convertingYearBudgetIdsRef.current.delete(budget.id);
        }
      }
      if (!cancelled && changed) {
        queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [budgets]);

  const createBudget = useMutation({
    mutationFn: async (data: BudgetPayload) => {
      const res = await apiRequest("POST", "/api/budgets", data);
      return res.json();
    },
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setShowNewBudget(false);
      setNewBudgetName("");
      setNewBudgetIsFolder(false);
      setNewBudgetParentId("none");
      setNewBudgetOpeningBalance("0");
      if (!budget.isFolder) {
        onSelectBudget(budget.id);
      }
    },
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/budgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setShowDeleteConfirm(false);
      setDeletingBudget(null);
    },
  });

  const cloneBudget = useMutation({
    mutationFn: async (data: { id: number; name: string; parentId?: number }) => {
      const res = await apiRequest("POST", `/api/budgets/${data.id}/clone`, {
        name: data.name,
        parentId: data.parentId,
      });
      return res.json();
    },
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setShowCloneDialog(false);
      setCloneSourceBudget(null);
      setCloneName("");
      setCloneParentId("none");
      onSelectBudget(budget.id);
    },
  });

  const updateNavigationPreferences = useMutation({
    mutationFn: async (data: Partial<NavigationPreferences>) => {
      const res = await apiRequest("PATCH", "/api/user-preferences/navigation", data);
      return res.json();
    },
    onSuccess: (saved: NavigationPreferences) => {
      const normalized = normalizeNavigationState(saved);
      queryClient.setQueryData(["/api/user-preferences/navigation"], normalized);
      setNavigationState((prev) => ({
        ...prev,
        hiddenToolIds: normalized.hiddenToolIds ?? [],
      }));
    },
  });

  const navItems = [
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "annual", label: "Annual Overview", icon: Calendar },
    { id: "goals", label: "Savings Goals", icon: Target },
    { id: "networth", label: "Net Worth", icon: Landmark },
    { id: "whatif", label: "What If", icon: FlaskConical },
    { id: "history", label: "History", icon: History },
    { id: "tags", label: "Manage Tags", icon: Tag },
    { id: "favorites", label: "Favorites", icon: Star },
    { id: "compare", label: "Compare", icon: ArrowLeftRight },
  ];
  const allowedToolIds = new Set(navItems.map((item) => item.id));
  const normalizeNavigationState = (prefs?: NavigationPreferences | null): NavigationPreferences => ({
    hiddenToolIds: Array.from(
      new Set((prefs?.hiddenToolIds ?? []).filter((id) => allowedToolIds.has(id))),
    ),
    moreExpanded: prefs?.moreExpanded ?? false,
  });

  useEffect(() => {
    const normalized = normalizeNavigationState(navigationPreferences);
    setNavigationState((prev) => ({
      ...prev,
      hiddenToolIds: normalized.hiddenToolIds ?? [],
      moreExpanded: normalized.moreExpanded ?? false,
    }));
    if (!didInitMoreOpenRef.current) {
      setMoreOpen(normalized.moreExpanded ?? false);
      didInitMoreOpenRef.current = true;
    }
  }, [navigationPreferences]);

  const hiddenToolIds = navigationState.hiddenToolIds ?? [];
  const visibleNavItems = navItems.filter((item) => !hiddenToolIds.includes(item.id));

  function patchNavigationPreferences(patch: Partial<NavigationPreferences>) {
    const next = normalizeNavigationState({
      hiddenToolIds,
      moreExpanded: moreOpen,
      ...patch,
    });
    setNavigationState((prev) => ({
      ...prev,
      hiddenToolIds: next.hiddenToolIds ?? [],
      moreExpanded: next.moreExpanded ?? false,
    }));
    updateNavigationPreferences.mutate({
      hiddenToolIds: next.hiddenToolIds,
    });
  }

  function handleCreateBudget() {
    if (!newBudgetName) return;
    const parsedOpeningBalance = Number(newBudgetOpeningBalance);
    if (!Number.isFinite(parsedOpeningBalance)) return;

    createBudget.mutate({
      name: newBudgetName,
      period: newBudgetPeriod,
      startDate: format(new Date(), "yyyy-MM-dd"),
      isActive: true,
      sortOrder: budgets.length,
      isFolder: newBudgetIsFolder,
      parentId: newBudgetParentId !== "none" ? Number(newBudgetParentId) : null,
      currency: newBudgetCurrency,
      openingBalance: parsedOpeningBalance,
    });
  }

  function requestDeleteBudget(budget: Budget) {
    if (budget.isFolder) {
      setDeletingBudget(budget);
      setShowDeleteConfirm(true);
    } else {
      deleteBudget.mutate(budget.id);
    }
  }

  function requestCloneBudget(budget: Budget) {
    setCloneSourceBudget(budget);
    setCloneName(`${budget.name} Copy`);
    setCloneParentId(budget.parentId ? String(budget.parentId) : "none");
    setShowCloneDialog(true);
  }

  function handleCloneSubmit() {
    if (!cloneSourceBudget || !cloneName) return;
    cloneBudget.mutate({
      id: cloneSourceBudget.id,
      name: cloneName,
      parentId: cloneParentId !== "none" ? Number(cloneParentId) : undefined,
    });
  }

  function handleMoreOpenChange(open: boolean) {
    setMoreOpen(open);
  }

  function toggleToolVisibility(toolId: string) {
    const nextHidden = hiddenToolIds.includes(toolId)
      ? hiddenToolIds.filter((id) => id !== toolId)
      : [...hiddenToolIds, toolId];
    patchNavigationPreferences({ hiddenToolIds: nextHidden });
  }

  function renderBudgetItem(budget: Budget, depth = 0) {
    return (
      <SidebarMenuItem key={budget.id} data-testid={`budget-item-${budget.id}`}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectBudget(budget.id)}
          data-active={activeBudgetId === budget.id && activeView === "budget"}
          data-testid={`button-budget-${budget.id}`}
          className={`flex items-center gap-2 w-full rounded-md pr-2 py-1.5 text-sm cursor-pointer hover:bg-sidebar-accent ${activeBudgetId === budget.id && activeView === "budget" ? "bg-sidebar-accent font-medium" : ""}`}
          style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
        >
          <Wallet className="w-4 h-4 shrink-0 text-sidebar-primary" />
          <span className="flex-1 truncate">{budget.name}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded hover:bg-sidebar-accent"
                data-testid={`button-budget-actions-${budget.id}`}
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  requestCloneBudget(budget);
                }}
                data-testid={`button-clone-budget-${budget.id}`}
              >
                Clone budget
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  requestDeleteBudget(budget);
                }}
                data-testid={`button-delete-budget-${budget.id}`}
                className="text-destructive focus:text-destructive"
              >
                Delete budget
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarMenuItem>
    );
  }

  function renderFolder(folder: Budget, depth = 0) {
    const children = getChildBudgets(folder.id);
    const open = isFolderOpen(folder.id);

    return (
      <Collapsible
        key={folder.id}
        open={open}
        onOpenChange={(val) => setFolderOpenState(prev => ({ ...prev, [folder.id]: val }))}
        data-testid={`folder-${folder.id}`}
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              className="flex items-center gap-2 w-full rounded-md pr-2 py-1.5 text-sm cursor-pointer hover:bg-sidebar-accent"
              style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
              data-testid={`button-budget-${folder.id}`}
            >
              {open ? <FolderOpen className="w-4 h-4 shrink-0" /> : <Folder className="w-4 h-4 shrink-0" />}
              <span className="flex-1 truncate font-medium">{folder.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(event) => event.stopPropagation()}
                    className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded hover:bg-sidebar-accent"
                    data-testid={`button-budget-actions-${folder.id}`}
                  >
                    <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      requestDeleteBudget(folder);
                    }}
                    data-testid={`button-delete-budget-${folder.id}`}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CollapsibleTrigger>
        </SidebarMenuItem>
        <CollapsibleContent>
          <SidebarMenu>
            {children.map((child) => renderTreeNode(child, depth + 1))}
            {children.length === 0 && (
              <p className="text-xs text-muted-foreground py-1" style={{ paddingLeft: `${1.4 + depth * 0.9}rem` }}>Empty folder</p>
            )}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  function renderTreeNode(node: Budget, depth = 0) {
    if (node.isFolder) return renderFolder(node, depth);
    return renderBudgetItem(node, depth);
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          <span className="text-base font-bold tracking-tight">Echo</span>
        </div>
        {user && (
          <div className="flex items-center gap-2 mt-2 px-1">
            {user.profileImageUrl && (
              <img src={user.profileImageUrl} alt="" className="w-6 h-6 rounded-full" data-testid="img-user-avatar" />
            )}
            <span className="text-xs text-muted-foreground truncate flex-1" data-testid="text-user-name">
              {user.firstName || user.email || "User"}
            </span>
            <button
              type="button"
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Core</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onSelectView("home")}
                  data-active={activeView === "home"}
                  data-testid="button-nav-home"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between gap-1">
            <span>Budgets</span>
            <Dialog open={showNewBudget} onOpenChange={(open) => {
              setShowNewBudget(open);
              if (!open) {
                setNewBudgetIsFolder(false);
                setNewBudgetParentId("none");
                setNewBudgetName("");
                setNewBudgetCurrency("USD");
                setNewBudgetOpeningBalance("0");
              }
            }}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-5 w-5" data-testid="button-new-budget">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Budget</DialogTitle>
                  <DialogDescription>Create a new budget or folder to organize your budgets.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <Input
                    placeholder={newBudgetIsFolder ? "Folder name" : "Budget name"}
                    value={newBudgetName}
                    onChange={(e) => setNewBudgetName(e.target.value)}
                    data-testid="input-new-budget-name"
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is-folder"
                      checked={newBudgetIsFolder}
                      onCheckedChange={(checked) => setNewBudgetIsFolder(checked === true)}
                      data-testid="button-create-folder"
                    />
                    <Label htmlFor="is-folder" className="text-sm">Create as folder</Label>
                  </div>
                  {!newBudgetIsFolder && (
                    <>
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
                      <Select value={newBudgetCurrency} onValueChange={setNewBudgetCurrency}>
                        <SelectTrigger data-testid="select-budget-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.symbol} {c.code} - {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <Input
                    placeholder="Opening balance"
                    type="number"
                    step="0.01"
                    value={newBudgetOpeningBalance}
                    onChange={(e) => setNewBudgetOpeningBalance(e.target.value)}
                    data-testid="input-new-budget-opening-balance"
                  />
                  {folderOptions.length > 0 && (
                    <Select value={newBudgetParentId} onValueChange={setNewBudgetParentId}>
                      <SelectTrigger data-testid="select-parent-folder">
                        <SelectValue placeholder="Parent folder (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No folder</SelectItem>
                        {folderOptions.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                            {`${"-- ".repeat(f.depth)}${f.name}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    onClick={handleCreateBudget}
                    className="w-full"
                    disabled={!newBudgetName || createBudget.isPending}
                    data-testid="button-create-budget"
                  >
                    {createBudget.isPending ? "Creating..." : newBudgetIsFolder ? "Create Folder" : "Create Budget"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {rootBudgets.map((node) => renderTreeNode(node))}
              {budgets.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">No budgets yet. Create one to get started.</p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between gap-1">
            <span>More</span>
            <Dialog open={showNavigationSettings} onOpenChange={setShowNavigationSettings}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-5 w-5" data-testid="button-open-nav-settings">
                  <Settings2 className="w-3.5 h-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Sidebar Preferences</DialogTitle>
                  <DialogDescription>Show or hide optional tool pages in the More section.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 pt-2">
                  {navItems.map((item) => {
                    const visible = !hiddenToolIds.includes(item.id);
                    return (
                      <label key={item.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                        <span className="flex items-center gap-2 text-sm">
                          <item.icon className="w-4 h-4 text-muted-foreground" />
                          {item.label}
                        </span>
                        <Checkbox
                          checked={visible}
                          onCheckedChange={() => toggleToolVisibility(item.id)}
                          disabled={updateNavigationPreferences.isPending}
                          data-testid={`checkbox-nav-${item.id}`}
                        />
                      </label>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <Collapsible open={moreOpen} onOpenChange={handleMoreOpenChange}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton data-testid="button-toggle-more-tools">
                      <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? "rotate-0" : "-rotate-90"}`} />
                      <span>Tools</span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
              </SidebarMenu>
              <CollapsibleContent>
                <SidebarMenu className="mt-1">
                  {visibleNavItems.map((item) => (
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
                  {visibleNavItems.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">All optional tools are hidden.</p>
                  )}
                </SidebarMenu>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {darkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            <span>{darkMode ? "Dark" : "Light"}</span>
          </div>
          <SwitchComponent
            checked={darkMode}
            onCheckedChange={setDarkMode}
            data-testid="button-dark-mode-toggle"
          />
        </div>
        <div className="flex items-center flex-wrap gap-1.5">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className="w-5 h-5 rounded-full shrink-0 transition-shadow"
              style={{
                backgroundColor: t.preview,
                boxShadow: theme === t.id ? `0 0 0 2px hsl(var(--sidebar)), 0 0 0 4px ${t.preview}` : "none",
              }}
              title={t.name}
              data-testid={`button-theme-${t.id}`}
            />
          ))}
        </div>
      </SidebarFooter>

      <Dialog open={showCloneDialog} onOpenChange={(open) => {
        setShowCloneDialog(open);
        if (!open) {
          setCloneSourceBudget(null);
          setCloneName("");
          setCloneParentId("none");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Budget</DialogTitle>
            <DialogDescription>Create a copy of "{cloneSourceBudget?.name}" with all its categories and entries.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="New budget name"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              data-testid="input-clone-budget-name"
            />
            {folderOptions.length > 0 && (
              <Select value={cloneParentId} onValueChange={setCloneParentId}>
                <SelectTrigger data-testid="select-clone-parent-folder">
                  <SelectValue placeholder="Parent folder (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {folderOptions.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {`${"-- ".repeat(f.depth)}${f.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={handleCloneSubmit}
              className="w-full"
              disabled={!cloneName || cloneBudget.isPending}
              data-testid="button-submit-clone"
            >
              {cloneBudget.isPending ? "Cloning..." : "Clone Budget"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={(open) => {
        setShowDeleteConfirm(open);
        if (!open) setDeletingBudget(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingBudget?.name}"? All sub-budgets inside this folder will also be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingBudget && deleteBudget.mutate(deletingBudget.id)}
              disabled={deleteBudget.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteBudget.isPending ? "Deleting..." : "Delete Folder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
