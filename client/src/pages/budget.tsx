import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Budget, Entry, Category, Tag, Favorite, InsertEntry } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Star, Trash2, Edit2, RotateCcw, GripVertical, Tag as TagIcon, CalendarIcon, Download, Zap, X, Settings2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { exportBudgetToCSV } from "@/lib/export-csv";
import { formatCurrency } from "@/lib/currency";
import { orderEntriesForTimeline, type EntryOrderMode } from "@/lib/entry-order";

function useAnimatedNumber(value: number, duration = 500) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const rafRef = useRef<number>();

  useEffect(() => {
    const start = previousValue.current;
    const end = value;
    previousValue.current = value;

    if (start === end) return;

    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(start + (end - start) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return displayValue;
}

interface BudgetPageProps {
  budgetId: number;
  categoriesButton?: ReactNode;
}

type BalanceContext = {
  effectiveOpeningBalance: number;
  computedClosingBalance: number;
  carryoverSourceBudgetId: number | null;
  mode: "manual" | "carryover";
};

type SortableEntryRowProps = {
  entry: Entry;
  dragEnabled: boolean;
  budgetCurrency: string;
  categoryName: string | null;
  categoryColor: string | undefined;
  tagBadges: Array<{ id: number; name: string; color: string }>;
  trailingBalance: number;
  onTogglePaid: (entry: Entry, checked: boolean) => void;
  onToggleStar: (entry: Entry) => void;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
};

function SortableEntryRow({
  entry,
  dragEnabled,
  budgetCurrency,
  categoryName,
  categoryColor,
  tagBadges,
  trailingBalance,
  onTogglePaid,
  onToggleStar,
  onEdit,
  onDelete,
}: SortableEntryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    disabled: !dragEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isIncome = entry.type === "income";
  const statusLabel = isIncome ? "Received" : "Paid";
  const isStarredUnpaidExpense = entry.isStarred && !entry.isPaidOrReceived && entry.type === "expense";

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`entry-row-${entry.id}`}
      className={`rounded-lg border border-border/80 bg-card transition-shadow ${
        isDragging ? "shadow-lg" : "shadow-sm"
      } ${entry.isPaidOrReceived ? "opacity-65" : ""} ${isStarredUnpaidExpense ? "ring-1 ring-amber-300 dark:ring-amber-700" : ""}`}
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Checkbox
            data-testid={`checkbox-paid-${entry.id}`}
            checked={entry.isPaidOrReceived}
            onCheckedChange={(checked) => onTogglePaid(entry, !!checked)}
            className="mt-1 shrink-0"
          />

          <button
            data-testid={`button-star-${entry.id}`}
            onClick={() => onToggleStar(entry)}
            className="mt-0.5 flex min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-md"
          >
            <Star
              className={`h-4 w-4 ${entry.isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
            />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`break-words text-sm font-medium ${entry.isPaidOrReceived ? "line-through" : ""}`}
                data-testid={`text-entry-name-${entry.id}`}
              >
                {entry.name}
              </span>
              {entry.isPaidOrReceived && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {statusLabel}
                </Badge>
              )}
              {isStarredUnpaidExpense && (
                <Badge
                  data-testid="badge-unpaid"
                  variant="secondary"
                  className="bg-amber-100 px-1.5 py-0 text-[10px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                >
                  Unpaid
                </Badge>
              )}
              {categoryName && (
                <Badge
                  variant="outline"
                  className="px-1.5 py-0 text-[10px]"
                  style={{ borderColor: categoryColor, color: categoryColor }}
                >
                  {categoryName}
                </Badge>
              )}
              {tagBadges.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="px-1.5 py-0 text-[10px]"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.name}
                </Badge>
              ))}
              {entry.isRecurring && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  <RotateCcw className="mr-0.5 h-2.5 w-2.5" />
                  {entry.recurringFrequency}
                </Badge>
              )}
            </div>

            {entry.note && <p className="mt-0.5 break-words text-xs text-muted-foreground">{entry.note}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">{format(parseISO(entry.date), "MMM d, yyyy")}</p>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 sm:justify-end">
          <div className="flex flex-col items-start gap-0.5 sm:items-end">
            <span
              className={`text-sm font-semibold tabular-nums ${
                isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
              data-testid={`text-entry-amount-${entry.id}`}
            >
              {isIncome ? "+" : "-"}
              {formatCurrency(entry.amount, budgetCurrency)}
            </span>
            <span
              className={`text-[11px] tabular-nums ${
                trailingBalance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"
              }`}
              data-testid={`text-entry-trailing-balance-${entry.id}`}
            >
              Balance {formatCurrency(trailingBalance, budgetCurrency)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {dragEnabled && (
              <Button
                size="icon"
                variant="ghost"
                className="touch-none select-none cursor-grab active:cursor-grabbing"
                data-testid={`button-entry-drag-${entry.id}`}
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => onEdit(entry)} data-testid={`button-edit-${entry.id}`}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onDelete(entry)} data-testid={`button-delete-${entry.id}`}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BudgetPage({ budgetId, categoriesButton }: BudgetPageProps) {
  const { toast } = useToast();
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [filterTag, setFilterTag] = useState<number | null>(null);
  const [entryType, setEntryType] = useState<"income" | "expense">("expense");
  const [entryName, setEntryName] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [entryCategoryId, setEntryCategoryId] = useState<string>("none");
  const [entryTagIds, setEntryTagIds] = useState<number[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(undefined);
  const [recurringEndAmount, setRecurringEndAmount] = useState("");
  const [openingBalanceInput, setOpeningBalanceInput] = useState("0");
  const [orderedEntries, setOrderedEntries] = useState<Entry[]>([]);

  const { data: budget } = useQuery<Budget>({ queryKey: ["/api/budgets", budgetId] });
  const { data: entries = [], isLoading } = useQuery<Entry[]>({ queryKey: ["/api/budgets", budgetId, "entries"] });
  const { data: categoriesData = [] } = useQuery<Category[]>({ queryKey: ["/api/budgets", budgetId, "categories"] });
  const { data: tagsData = [] } = useQuery<Tag[]>({ queryKey: ["/api/tags"] });
  const { data: favoritesData = [] } = useQuery<Favorite[]>({ queryKey: ["/api/favorites"] });
  const { data: balanceContext } = useQuery<BalanceContext>({
    queryKey: ["/api/budgets", budgetId, "balance-context"],
    enabled: !!budget,
  });

  useEffect(() => {
    setOrderedEntries(entries);
  }, [entries]);

  useEffect(() => {
    if (!budget) return;
    setOpeningBalanceInput((budget.openingBalance ?? 0).toString());
  }, [budget]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 6,
      },
    }),
  );

  function invalidateEntriesAcrossBudgets() {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "/api/budgets" &&
        query.queryKey[2] === "entries",
    });
  }

  const quickAddFromFavorite = useMutation({
    mutationFn: async (fav: Favorite) => {
      const data = {
        budgetId,
        type: fav.type,
        name: fav.name,
        amount: fav.amount,
        note: fav.note || null,
        date: format(new Date(), "yyyy-MM-dd"),
        categoryId: fav.categoryId || null,
        tagIds: fav.tagIds || null,
        isPaidOrReceived: false,
        isStarred: false,
        sortOrder: orderedEntries.length,
        isRecurring: false,
        recurringFrequency: null,
        recurringEndDate: null,
        recurringEndAmount: null,
        recurringParentId: null,
      };
      const res = await apiRequest("POST", "/api/entries", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateEntriesAcrossBudgets();
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "balance-context"] });
      toast({ title: "Entry added from favorite" });
    },
  });

  const createEntry = useMutation({
    mutationFn: async (data: InsertEntry) => {
      const res = await apiRequest("POST", "/api/entries", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateEntriesAcrossBudgets();
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "balance-context"] });
      resetForm();
      toast({ title: "Entry added" });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertEntry> }) => {
      const res = await apiRequest("PATCH", `/api/entries/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateEntriesAcrossBudgets();
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "balance-context"] });
      setEditingEntry(null);
      resetForm();
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/entries/${id}`);
    },
    onSuccess: () => {
      invalidateEntriesAcrossBudgets();
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "balance-context"] });
      toast({ title: "Entry deleted" });
    },
  });

  const togglePaid = useMutation({
    mutationFn: async ({ id, isPaidOrReceived }: { id: number; isPaidOrReceived: boolean }) => {
      const res = await apiRequest("PATCH", `/api/entries/${id}`, { isPaidOrReceived });
      return res.json();
    },
    onSuccess: () => {
      invalidateEntriesAcrossBudgets();
    },
  });

  const toggleStar = useMutation({
    mutationFn: async ({ id, isStarred }: { id: number; isStarred: boolean }) => {
      const res = await apiRequest("PATCH", `/api/entries/${id}`, { isStarred });
      return res.json();
    },
    onSuccess: () => {
      invalidateEntriesAcrossBudgets();
    },
  });

  const reorderEntries = useMutation({
    mutationFn: async (orderedEntryIds: number[]) => {
      const res = await apiRequest("PATCH", `/api/budgets/${budgetId}/entries/reorder`, {
        orderedEntryIds,
      });
      return res.json() as Promise<Entry[]>;
    },
    onSuccess: (reordered) => {
      setOrderedEntries(reordered);
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId] });
      toast({
        title: "Unable to save order",
        description: "The entry list was refreshed to the last saved order.",
        variant: "destructive",
      });
    },
  });

  const saveBudgetSettings = useMutation({
    mutationFn: async ({ openingBalance }: { openingBalance: number }) => {
      const res = await apiRequest("PATCH", `/api/budgets/${budgetId}`, {
        openingBalance,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "balance-context"] });
      setShowBudgetSettings(false);
      toast({ title: "Budget settings updated" });
    },
  });

  const entryOrderMode: EntryOrderMode = budget?.entryOrderMode === "manual" ? "manual" : "auto_date";
  const timelineBaseEntries = useMemo(
    () => orderEntriesForTimeline(orderedEntries, entryOrderMode),
    [orderedEntries, entryOrderMode],
  );

  const filteredEntries = filterTag
    ? timelineBaseEntries.filter((entry) => entry.tagIds?.includes(filterTag))
    : timelineBaseEntries;

  const timelineEntries = filteredEntries;

  const effectiveOpeningBalance = balanceContext?.effectiveOpeningBalance ?? budget?.openingBalance ?? 0;

  const runningBalanceByEntryId = useMemo(() => {
    let running = effectiveOpeningBalance;
    const next = new Map<number, number>();
    for (const entry of timelineEntries) {
      running += entry.type === "income" ? entry.amount : -entry.amount;
      next.set(entry.id, running);
    }
    return next;
  }, [timelineEntries, effectiveOpeningBalance]);

  const incomeEntries = filteredEntries.filter((entry) => entry.type === "income");
  const expenseEntries = filteredEntries.filter((entry) => entry.type === "expense");
  const totalIncome = incomeEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpenses = expenseEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const closingBalance = effectiveOpeningBalance + totalIncome - totalExpenses;

  const budgetCurrency = budget?.currency || "USD";

  const animatedOpeningBalance = useAnimatedNumber(effectiveOpeningBalance);
  const animatedIncome = useAnimatedNumber(totalIncome);
  const animatedExpenses = useAnimatedNumber(totalExpenses);
  const animatedClosingBalance = useAnimatedNumber(closingBalance);

  function getCategoryName(categoryId: number | null) {
    if (!categoryId) return null;
    const category = categoriesData.find((item) => item.id === categoryId);
    return category ? category.name : null;
  }

  function getCategoryColor(categoryId: number | null) {
    if (!categoryId) return undefined;
    const category = categoriesData.find((item) => item.id === categoryId);
    return category?.color;
  }

  function getTagName(tagId: number) {
    const tag = tagsData.find((item) => item.id === tagId);
    return tag?.name || "";
  }

  function getTagColor(tagId: number) {
    const tag = tagsData.find((item) => item.id === tagId);
    return tag?.color || "#8b5cf6";
  }

  function resetForm() {
    setEntryName("");
    setEntryAmount("");
    setEntryNote("");
    setEntryDate(new Date());
    setEntryCategoryId("none");
    setEntryTagIds([]);
    setIsRecurring(false);
    setRecurringFrequency("monthly");
    setRecurringEndDate(undefined);
    setRecurringEndAmount("");
    setShowAddEntry(false);
    setEntryType("expense");
  }

  function handleSubmit() {
    if (!entryName || !entryAmount) return;

    const parsedAmount = Number(entryAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Amount must be greater than 0", variant: "destructive" });
      return;
    }

    const parsedRecurringEndAmount =
      isRecurring && recurringEndAmount.trim()
        ? Number(recurringEndAmount)
        : null;

    if (parsedRecurringEndAmount != null && (!Number.isFinite(parsedRecurringEndAmount) || parsedRecurringEndAmount <= 0)) {
      toast({ title: "Recurring end amount must be greater than 0", variant: "destructive" });
      return;
    }
    if (parsedRecurringEndAmount != null && parsedRecurringEndAmount < parsedAmount) {
      toast({
        title: "Recurring cap must be at least one entry amount",
        variant: "destructive",
      });
      return;
    }

    const data: InsertEntry = {
      budgetId,
      type: entryType,
      name: entryName,
      amount: parsedAmount,
      note: entryNote || null,
      date: format(entryDate, "yyyy-MM-dd"),
      categoryId: entryCategoryId !== "none" ? Number(entryCategoryId) : null,
      tagIds: entryTagIds.length > 0 ? entryTagIds : null,
      isPaidOrReceived: editingEntry ? editingEntry.isPaidOrReceived : false,
      isStarred: editingEntry ? editingEntry.isStarred : false,
      sortOrder: orderedEntries.length,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : null,
      recurringEndDate: isRecurring && recurringEndDate ? format(recurringEndDate, "yyyy-MM-dd") : null,
      recurringEndAmount: isRecurring ? parsedRecurringEndAmount : null,
      recurringParentId: editingEntry ? editingEntry.recurringParentId : null,
    };

    if (editingEntry) {
      updateEntry.mutate({ id: editingEntry.id, data });
    } else {
      createEntry.mutate(data);
    }
  }

  function startEdit(entry: Entry) {
    setEditingEntry(entry);
    setEntryType(entry.type as "income" | "expense");
    setEntryName(entry.name);
    setEntryAmount(entry.amount.toString());
    setEntryNote(entry.note || "");
    setEntryDate(parseISO(entry.date));
    setEntryCategoryId(entry.categoryId?.toString() || "none");
    setEntryTagIds(entry.tagIds || []);
    setIsRecurring(entry.isRecurring);
    setRecurringFrequency(entry.recurringFrequency || "monthly");
    setRecurringEndDate(entry.recurringEndDate ? parseISO(entry.recurringEndDate) : undefined);
    setRecurringEndAmount(entry.recurringEndAmount != null ? entry.recurringEndAmount.toString() : "");
    setShowAddEntry(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (filterTag) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = timelineEntries.findIndex((entry) => entry.id === active.id);
    const newIndex = timelineEntries.findIndex((entry) => entry.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(timelineEntries, oldIndex, newIndex);
    if (entryOrderMode !== "manual") {
      queryClient.setQueryData<Budget>(["/api/budgets", budgetId], (current) =>
        current ? { ...current, entryOrderMode: "manual" } : current,
      );
    }
    setOrderedEntries(next);
    reorderEntries.mutate(next.map((entry) => entry.id));
  }

  function handleSaveBudgetSettings() {
    const parsedOpeningBalance = Number(openingBalanceInput);
    if (!Number.isFinite(parsedOpeningBalance)) {
      toast({ title: "Opening balance must be a number", variant: "destructive" });
      return;
    }

    saveBudgetSettings.mutate({
      openingBalance: parsedOpeningBalance,
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <h1 className="text-base font-semibold sm:text-lg" data-testid="text-budget-name">
            {budget?.name || "Budget"}
          </h1>
          {budget?.description && <p className="text-xs text-muted-foreground">{budget.description}</p>}
          {balanceContext?.mode === "carryover" && (
            <p className="text-[11px] text-muted-foreground">
              Carryover {balanceContext.carryoverSourceBudgetId ? `from budget #${balanceContext.carryoverSourceBudgetId}` : "from year opening balance"}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {categoriesButton}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowBudgetSettings(true)}
            data-testid="button-budget-settings"
          >
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            Settings
          </Button>

          {tagsData.length > 0 && (
            <Select value={filterTag?.toString() || "all"} onValueChange={(value) => setFilterTag(value === "all" ? null : Number(value))}>
              <SelectTrigger className="w-[130px] sm:w-[140px]" data-testid="select-filter-tag">
                <TagIcon className="mr-1 h-3 w-3" />
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {tagsData.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id.toString()}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {favoritesData.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-quick-add-favorites">
                  <Zap className="mr-1 h-3 w-3" />
                  Quick Add
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="space-y-1">
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Add from favorites</p>
                  {favoritesData.map((favorite) => {
                    const isIncome = favorite.type === "income";
                    return (
                      <div
                        key={favorite.id}
                        className="hover-elevate flex items-center gap-2 rounded-md px-2 py-1.5"
                        data-testid={`quick-add-item-${favorite.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{favorite.name}</span>
                          <span className={`text-xs ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {isIncome ? "+" : "-"}
                            {formatCurrency(favorite.amount, budgetCurrency)}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => quickAddFromFavorite.mutate(favorite)}
                          disabled={quickAddFromFavorite.isPending}
                          data-testid={`button-quick-add-${favorite.id}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => exportBudgetToCSV(budget?.name || "Budget", orderedEntries, categoriesData, tagsData)}
            data-testid="button-export-csv"
          >
            <Download className="mr-1 h-3 w-3" />
            CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:gap-3">
            <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-900/30">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Opening</p>
              <p className="text-base font-bold tabular-nums text-slate-700 dark:text-slate-200 sm:text-lg" data-testid="text-opening-balance">
                {formatCurrency(animatedOpeningBalance, budgetCurrency)}
              </p>
            </div>
            <div className="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/30">
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Income</p>
              <p className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-lg" data-testid="text-total-income">
                {formatCurrency(animatedIncome, budgetCurrency)}
              </p>
            </div>
            <div className="rounded-md bg-red-50 p-3 dark:bg-red-950/30">
              <p className="text-[10px] font-medium uppercase tracking-wider text-red-700 dark:text-red-400">Expenses</p>
              <p className="text-base font-bold tabular-nums text-red-700 dark:text-red-400 sm:text-lg" data-testid="text-total-expenses">
                {formatCurrency(animatedExpenses, budgetCurrency)}
              </p>
            </div>
            <div className={`rounded-md p-3 ${closingBalance >= 0 ? "bg-blue-50 dark:bg-blue-950/30" : "bg-orange-50 dark:bg-orange-950/30"}`}>
              <p className={`text-[10px] font-medium uppercase tracking-wider ${closingBalance >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}>
                Closing
              </p>
              <p
                className={`text-base font-bold tabular-nums sm:text-lg ${closingBalance >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}
                data-testid="text-balance"
              >
                {formatCurrency(animatedClosingBalance, budgetCurrency)}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h2>
              <span className="text-xs text-muted-foreground">{timelineEntries.length} items</span>
            </div>

            {filterTag && (
              <p className="mb-2 text-xs text-muted-foreground">Disable tag filter to reorder entries.</p>
            )}
            {!filterTag && entryOrderMode === "auto_date" && (
              <p className="mb-2 text-xs text-muted-foreground">
                Sorted by date. Drag to switch to manual order.
              </p>
            )}

            {timelineEntries.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">No entries yet</p>
            ) : filterTag ? (
              <div className="space-y-2">
                {timelineEntries.map((entry) => (
                  <SortableEntryRow
                    key={entry.id}
                    entry={entry}
                    dragEnabled={false}
                    budgetCurrency={budgetCurrency}
                    categoryName={getCategoryName(entry.categoryId)}
                    categoryColor={getCategoryColor(entry.categoryId)}
                    tagBadges={(entry.tagIds || []).map((tagId) => ({
                      id: tagId,
                      name: getTagName(tagId),
                      color: getTagColor(tagId),
                    }))}
                    trailingBalance={runningBalanceByEntryId.get(entry.id) ?? effectiveOpeningBalance}
                    onTogglePaid={(target, checked) => togglePaid.mutate({ id: target.id, isPaidOrReceived: checked })}
                    onToggleStar={(target) => toggleStar.mutate({ id: target.id, isStarred: !target.isStarred })}
                    onEdit={startEdit}
                    onDelete={(target) => deleteEntry.mutate(target.id)}
                  />
                ))}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={timelineEntries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {timelineEntries.map((entry) => (
                      <SortableEntryRow
                        key={entry.id}
                        entry={entry}
                        dragEnabled
                        budgetCurrency={budgetCurrency}
                        categoryName={getCategoryName(entry.categoryId)}
                        categoryColor={getCategoryColor(entry.categoryId)}
                        tagBadges={(entry.tagIds || []).map((tagId) => ({
                          id: tagId,
                          name: getTagName(tagId),
                          color: getTagColor(tagId),
                        }))}
                        trailingBalance={runningBalanceByEntryId.get(entry.id) ?? effectiveOpeningBalance}
                        onTogglePaid={(target, checked) => togglePaid.mutate({ id: target.id, isPaidOrReceived: checked })}
                        onToggleStar={(target) => toggleStar.mutate({ id: target.id, isStarred: !target.isStarred })}
                        onEdit={startEdit}
                        onDelete={(target) => deleteEntry.mutate(target.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {showAddEntry ? (
        <div className="space-y-3 border-t bg-card px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{editingEntry ? "Edit Entry" : "Add Entry"}</h3>
            <Button size="icon" variant="ghost" onClick={resetForm} data-testid="button-cancel-add">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={entryType === "income" ? "default" : "outline"}
              onClick={() => setEntryType("income")}
              className={entryType === "income" ? "bg-emerald-600 text-white" : ""}
              data-testid="button-type-income"
            >
              Income
            </Button>
            <Button
              size="sm"
              variant={entryType === "expense" ? "default" : "outline"}
              onClick={() => setEntryType("expense")}
              className={entryType === "expense" ? "bg-red-600 text-white" : ""}
              data-testid="button-type-expense"
            >
              Expense
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              placeholder="Name"
              value={entryName}
              onChange={(event) => setEntryName(event.target.value)}
              data-testid="input-entry-name"
            />
            <Input
              placeholder="Amount"
              type="number"
              step="0.01"
              value={entryAmount}
              onChange={(event) => setEntryAmount(event.target.value)}
              data-testid="input-entry-amount"
            />
          </div>

          <Textarea
            placeholder="Note (optional)"
            value={entryNote}
            onChange={(event) => setEntryNote(event.target.value)}
            className="resize-none text-sm"
            rows={2}
            data-testid="input-entry-note"
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-start text-left font-normal" data-testid="button-entry-date">
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {format(entryDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={entryDate} onSelect={(dateValue) => dateValue && setEntryDate(dateValue)} />
              </PopoverContent>
            </Popover>

            {categoriesData.length > 0 && (
              <Select value={entryCategoryId} onValueChange={setEntryCategoryId}>
                <SelectTrigger data-testid="select-entry-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categoriesData.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {tagsData.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tagsData.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={entryTagIds.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  style={
                    entryTagIds.includes(tag.id)
                      ? { backgroundColor: tag.color }
                      : { borderColor: tag.color, color: tag.color }
                  }
                  onClick={() => {
                    setEntryTagIds((previous) =>
                      previous.includes(tag.id)
                        ? previous.filter((id) => id !== tag.id)
                        : [...previous, tag.id],
                    );
                  }}
                  data-testid={`badge-tag-${tag.id}`}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              checked={isRecurring}
              onCheckedChange={(checked) => setIsRecurring(!!checked)}
              data-testid="checkbox-recurring"
            />
            <span className="text-sm">Recurring</span>
          </div>

          {isRecurring && (
            <div className="space-y-2 pl-6">
              <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                <SelectTrigger data-testid="select-recurring-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start text-left font-normal" data-testid="button-recurring-end-date">
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {recurringEndDate ? format(recurringEndDate, "MMM d, yyyy") : "No date cap"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={recurringEndDate} onSelect={setRecurringEndDate} />
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setRecurringEndDate(undefined)}
                        data-testid="button-clear-recurring-end-date"
                      >
                        Remove date cap
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Total recurrence cap"
                  value={recurringEndAmount}
                  onChange={(event) => setRecurringEndAmount(event.target.value)}
                  data-testid="input-recurring-end-amount"
                />
              </div>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={!entryName || !entryAmount || createEntry.isPending || updateEntry.isPending}
            data-testid="button-submit-entry"
          >
            {createEntry.isPending || updateEntry.isPending ? "Saving..." : editingEntry ? "Update" : "Add Entry"}
          </Button>
        </div>
      ) : (
        <div className="border-t p-3">
          <Button onClick={() => setShowAddEntry(true)} className="w-full" data-testid="button-add-entry">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Entry
          </Button>
        </div>
      )}

      <Dialog open={showBudgetSettings} onOpenChange={setShowBudgetSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Budget Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Opening balance</label>
              <Input
                type="number"
                step="0.01"
                value={openingBalanceInput}
                onChange={(event) => setOpeningBalanceInput(event.target.value)}
                data-testid="input-budget-opening-balance"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSaveBudgetSettings}
              disabled={saveBudgetSettings.isPending}
              data-testid="button-save-budget-settings"
            >
              {saveBudgetSettings.isPending ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
