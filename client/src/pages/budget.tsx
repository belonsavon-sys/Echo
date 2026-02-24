import { useState, useRef, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Budget, Entry, Category, Tag, Favorite } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Plus, Star, Trash2, Edit2, RotateCcw, GripVertical, ChevronDown, ChevronUp, Tag as TagIcon, CalendarIcon, Fuel, Check, X, Download, Zap } from "lucide-react";
import { format, parseISO } from "date-fns";
import { exportBudgetToCSV } from "@/lib/export-csv";
import { formatCurrency } from "@/lib/currency";

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

export default function BudgetPage({ budgetId, categoriesButton }: BudgetPageProps) {
  const { toast } = useToast();
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [filterTag, setFilterTag] = useState<number | null>(null);
  const [entryType, setEntryType] = useState<"income" | "expense">("expense");
  const [entryName, setEntryName] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [entryCategoryId, setEntryCategoryId] = useState<string>("");
  const [entryTagIds, setEntryTagIds] = useState<number[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(undefined);

  const { data: budget } = useQuery<Budget>({ queryKey: ["/api/budgets", budgetId] });
  const { data: entries = [], isLoading } = useQuery<Entry[]>({ queryKey: ["/api/budgets", budgetId, "entries"] });
  const { data: categoriesData = [] } = useQuery<Category[]>({ queryKey: ["/api/budgets", budgetId, "categories"] });
  const { data: tagsData = [] } = useQuery<Tag[]>({ queryKey: ["/api/tags"] });
  const { data: favoritesData = [] } = useQuery<Favorite[]>({ queryKey: ["/api/favorites"] });

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
        sortOrder: entries.length,
        isRecurring: false,
        recurringFrequency: null,
        recurringEndDate: null,
        recurringParentId: null,
      };
      const res = await apiRequest("POST", "/api/entries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "entries"] });
      toast({ title: "Entry added from favorite" });
    },
  });

  const filteredEntries = filterTag
    ? entries.filter(e => e.tagIds?.includes(filterTag))
    : entries;

  const incomeEntries = filteredEntries.filter(e => e.type === "income");
  const expenseEntries = filteredEntries.filter(e => e.type === "expense");

  const totalIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpenses;

  const budgetCurrency = budget?.currency || "USD";

  const animatedIncome = useAnimatedNumber(totalIncome);
  const animatedExpenses = useAnimatedNumber(totalExpenses);
  const animatedBalance = useAnimatedNumber(balance);

  const paidIncome = incomeEntries.filter(e => e.isPaidOrReceived).reduce((sum, e) => sum + e.amount, 0);
  const paidExpenses = expenseEntries.filter(e => e.isPaidOrReceived).reduce((sum, e) => sum + e.amount, 0);
  const moneyLeft = paidIncome - paidExpenses;
  const moneyLeftPercent = totalIncome > 0 ? Math.max(0, Math.min(100, (moneyLeft / totalIncome) * 100)) : 0;

  const createEntry = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/entries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "entries"] });
      resetForm();
      toast({ title: "Entry added" });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/entries/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "entries"] });
      setEditingEntry(null);
      resetForm();
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "history"] });
      toast({ title: "Entry deleted" });
    },
  });

  const togglePaid = useMutation({
    mutationFn: async ({ id, isPaidOrReceived }: { id: number; isPaidOrReceived: boolean }) => {
      const res = await apiRequest("PATCH", `/api/entries/${id}`, { isPaidOrReceived });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "entries"] });
    },
  });

  const toggleStar = useMutation({
    mutationFn: async ({ id, isStarred }: { id: number; isStarred: boolean }) => {
      const res = await apiRequest("PATCH", `/api/entries/${id}`, { isStarred });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets", budgetId, "entries"] });
    },
  });

  function resetForm() {
    setEntryName("");
    setEntryAmount("");
    setEntryNote("");
    setEntryDate(new Date());
    setEntryCategoryId("");
    setEntryTagIds([]);
    setIsRecurring(false);
    setRecurringFrequency("monthly");
    setRecurringEndDate(undefined);
    setShowAddEntry(false);
    setEntryType("expense");
  }

  function handleSubmit() {
    if (!entryName || !entryAmount) return;
    const data = {
      budgetId,
      type: entryType,
      name: entryName,
      amount: parseFloat(entryAmount),
      note: entryNote || null,
      date: format(entryDate, "yyyy-MM-dd"),
      categoryId: entryCategoryId ? parseInt(entryCategoryId) : null,
      tagIds: entryTagIds.length > 0 ? entryTagIds : null,
      isPaidOrReceived: false,
      isStarred: false,
      sortOrder: entries.length,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : null,
      recurringEndDate: isRecurring && recurringEndDate ? format(recurringEndDate, "yyyy-MM-dd") : null,
      recurringParentId: null,
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
    setEntryCategoryId(entry.categoryId?.toString() || "");
    setEntryTagIds(entry.tagIds || []);
    setIsRecurring(entry.isRecurring);
    setRecurringFrequency(entry.recurringFrequency || "monthly");
    setRecurringEndDate(entry.recurringEndDate ? parseISO(entry.recurringEndDate) : undefined);
    setShowAddEntry(true);
  }

  function getCategoryName(categoryId: number | null) {
    if (!categoryId) return null;
    const cat = categoriesData.find(c => c.id === categoryId);
    return cat ? cat.name : null;
  }

  function getCategoryColor(categoryId: number | null) {
    if (!categoryId) return undefined;
    const cat = categoriesData.find(c => c.id === categoryId);
    return cat?.color;
  }

  function getTagName(tagId: number) {
    const tag = tagsData.find(t => t.id === tagId);
    return tag?.name || "";
  }

  function getTagColor(tagId: number) {
    const tag = tagsData.find(t => t.id === tagId);
    return tag?.color || "#8b5cf6";
  }

  function renderEntry(entry: Entry) {
    const categoryName = getCategoryName(entry.categoryId);
    const categoryColor = getCategoryColor(entry.categoryId);
    const isIncome = entry.type === "income";
    const statusLabel = isIncome ? "Received" : "Paid";
    const isStarredUnpaidExpense = entry.isStarred && !entry.isPaidOrReceived && entry.type === "expense";

    return (
      <div
        key={entry.id}
        data-testid={`entry-row-${entry.id}`}
        className={`flex items-center gap-2 py-2.5 group hover-elevate rounded-md transition-all animate-fade-slide-in ${
          entry.isPaidOrReceived ? "opacity-60" : ""
        } ${isStarredUnpaidExpense ? "bg-amber-50 dark:bg-amber-950/20 pl-4 pr-3" : "px-3"}`}
      >
        <Checkbox
          data-testid={`checkbox-paid-${entry.id}`}
          checked={entry.isPaidOrReceived}
          onCheckedChange={(checked) => togglePaid.mutate({ id: entry.id, isPaidOrReceived: !!checked })}
          className="shrink-0"
        />

        <button
          data-testid={`button-star-${entry.id}`}
          onClick={() => toggleStar.mutate({ id: entry.id, isStarred: !entry.isStarred })}
          className="shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md"
        >
          <Star
            className={`w-4 h-4 ${entry.isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"} ${isStarredUnpaidExpense ? "animate-pulse-star" : ""}`}
          />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-medium truncate ${entry.isPaidOrReceived ? "line-through" : ""}`} data-testid={`text-entry-name-${entry.id}`}>
              {entry.name}
            </span>
            {entry.isPaidOrReceived && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {statusLabel}
              </Badge>
            )}
            {isStarredUnpaidExpense && (
              <Badge data-testid="badge-unpaid" variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                Unpaid
              </Badge>
            )}
            {categoryName && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0"
                style={{ borderColor: categoryColor, color: categoryColor }}
              >
                {categoryName}
              </Badge>
            )}
            {entry.tagIds?.map(tagId => (
              <Badge
                key={tagId}
                variant="outline"
                className="text-[10px] px-1.5 py-0"
                style={{ borderColor: getTagColor(tagId), color: getTagColor(tagId) }}
              >
                {getTagName(tagId)}
              </Badge>
            ))}
            {entry.isRecurring && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                <RotateCcw className="w-2.5 h-2.5 mr-0.5" />
                {entry.recurringFrequency}
              </Badge>
            )}
          </div>
          {entry.note && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.note}</p>
          )}
          <p className="text-[10px] text-muted-foreground">{format(parseISO(entry.date), "MMM d, yyyy")}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-sm font-semibold tabular-nums ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            data-testid={`text-entry-amount-${entry.id}`}
          >
            {isIncome ? "+" : "-"}{formatCurrency(entry.amount, budgetCurrency)}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" onClick={() => startEdit(entry)} data-testid={`button-edit-${entry.id}`}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => deleteEntry.mutate(entry.id)} data-testid={`button-delete-${entry.id}`}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    );
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
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold" data-testid="text-budget-name">{budget?.name || "Budget"}</h1>
          {budget?.description && (
            <p className="text-xs text-muted-foreground">{budget.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {categoriesButton}
          {tagsData.length > 0 && (
            <Select value={filterTag?.toString() || "all"} onValueChange={(v) => setFilterTag(v === "all" ? null : parseInt(v))}>
              <SelectTrigger className="w-[130px] sm:w-[140px]" data-testid="select-filter-tag">
                <TagIcon className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {tagsData.map(tag => (
                  <SelectItem key={tag.id} value={tag.id.toString()}>{tag.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {favoritesData.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-quick-add-favorites">
                  <Zap className="w-3 h-3 mr-1" />
                  Quick Add
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">Add from favorites</p>
                  {favoritesData.map((fav) => {
                    const isIncome = fav.type === "income";
                    return (
                      <div
                        key={fav.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover-elevate"
                        data-testid={`quick-add-item-${fav.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm truncate block">{fav.name}</span>
                          <span className={`text-xs ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {isIncome ? "+" : "-"}{formatCurrency(fav.amount, budgetCurrency)}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => quickAddFromFavorite.mutate(fav)}
                          disabled={quickAddFromFavorite.isPending}
                          data-testid={`button-quick-add-${fav.id}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
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
            onClick={() => exportBudgetToCSV(budget?.name || "Budget", entries, categoriesData, tagsData)}
            data-testid="button-export-csv"
          >
            <Download className="w-3 h-3 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-3">
              <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Income</p>
              <p className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums" data-testid="text-total-income">{formatCurrency(animatedIncome, budgetCurrency)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-3">
              <p className="text-[10px] font-medium text-red-700 dark:text-red-400 uppercase tracking-wider">Expenses</p>
              <p className="text-base sm:text-lg font-bold text-red-700 dark:text-red-400 tabular-nums" data-testid="text-total-expenses">{formatCurrency(animatedExpenses, budgetCurrency)}</p>
            </div>
            <div className={`rounded-md p-3 ${balance >= 0 ? "bg-blue-50 dark:bg-blue-950/30" : "bg-orange-50 dark:bg-orange-950/30"}`}>
              <p className={`text-[10px] font-medium uppercase tracking-wider ${balance >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}>Balance</p>
              <p className={`text-base sm:text-lg font-bold tabular-nums ${balance >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`} data-testid="text-balance">{formatCurrency(animatedBalance, budgetCurrency)}</p>
            </div>
          </div>

          <div className="bg-card rounded-md p-3 border border-card-border">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Fuel className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Money Left</span>
              </div>
              <span className={`text-sm font-bold tabular-nums ${moneyLeft >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-money-left">
                {formatCurrency(moneyLeft, budgetCurrency)}
              </span>
            </div>
            <Progress
              value={moneyLeftPercent}
              className="h-2"
              data-testid="progress-money-left"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Based on received income minus paid expenses</p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Income</h2>
              <span className="text-xs text-muted-foreground">{incomeEntries.length} items</span>
            </div>
            {incomeEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">No income entries yet</p>
            ) : (
              <div className="space-y-0.5">
                {incomeEntries.map(renderEntry)}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">Expenses</h2>
              <span className="text-xs text-muted-foreground">{expenseEntries.length} items</span>
            </div>
            {expenseEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">No expense entries yet</p>
            ) : (
              <div className="space-y-0.5">
                {[...expenseEntries].sort((a, b) => {
                  const aStarredUnpaid = a.isStarred && !a.isPaidOrReceived ? 1 : 0;
                  const bStarredUnpaid = b.isStarred && !b.isPaidOrReceived ? 1 : 0;
                  if (bStarredUnpaid !== aStarredUnpaid) return bStarredUnpaid - aStarredUnpaid;
                  return new Date(b.date).getTime() - new Date(a.date).getTime();
                }).map(renderEntry)}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddEntry ? (
        <div className="border-t px-3 sm:px-4 py-3 sm:py-4 bg-card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{editingEntry ? "Edit Entry" : "Add Entry"}</h3>
            <Button size="icon" variant="ghost" onClick={resetForm} data-testid="button-cancel-add">
              <X className="w-4 h-4" />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Name"
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              data-testid="input-entry-name"
            />
            <Input
              placeholder="Amount"
              type="number"
              step="0.01"
              value={entryAmount}
              onChange={(e) => setEntryAmount(e.target.value)}
              data-testid="input-entry-amount"
            />
          </div>

          <Textarea
            placeholder="Note (optional)"
            value={entryNote}
            onChange={(e) => setEntryNote(e.target.value)}
            className="resize-none text-sm"
            rows={2}
            data-testid="input-entry-note"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-start text-left font-normal" data-testid="button-entry-date">
                  <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                  {format(entryDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={entryDate} onSelect={(d) => d && setEntryDate(d)} />
              </PopoverContent>
            </Popover>

            {categoriesData.length > 0 && (
              <Select value={entryCategoryId} onValueChange={setEntryCategoryId}>
                <SelectTrigger data-testid="select-entry-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categoriesData.map(cat => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {tagsData.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tagsData.map(tag => (
                <Badge
                  key={tag.id}
                  variant={entryTagIds.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  style={entryTagIds.includes(tag.id) ? { backgroundColor: tag.color } : { borderColor: tag.color, color: tag.color }}
                  onClick={() => {
                    setEntryTagIds(prev =>
                      prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
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

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start text-left font-normal" data-testid="button-recurring-end-date">
                    <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                    {recurringEndDate ? format(recurringEndDate, "MMM d, yyyy") : "End of year"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={recurringEndDate} onSelect={setRecurringEndDate} />
                </PopoverContent>
              </Popover>
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
            <Plus className="w-4 h-4 mr-1.5" />
            Add Entry
          </Button>
        </div>
      )}
    </div>
  );
}
