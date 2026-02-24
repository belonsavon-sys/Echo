import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { NetWorthAccount } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, Landmark } from "lucide-react";
import { CURRENCIES, formatCurrency } from "@/lib/currency";

export default function NetWorthPage() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<NetWorthAccount | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("asset");
  const [formBalance, setFormBalance] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formNotes, setFormNotes] = useState("");

  const { data: accounts = [], isLoading } = useQuery<NetWorthAccount[]>({
    queryKey: ["/api/net-worth-accounts"],
  });

  const createAccount = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/net-worth-accounts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/net-worth-accounts"] });
      resetForm();
      toast({ title: "Account added" });
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/net-worth-accounts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/net-worth-accounts"] });
      resetForm();
      toast({ title: "Account updated" });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/net-worth-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/net-worth-accounts"] });
      setDeleteConfirmId(null);
      toast({ title: "Account deleted" });
    },
  });

  function resetForm() {
    setFormName("");
    setFormType("asset");
    setFormBalance("");
    setFormCurrency("USD");
    setFormNotes("");
    setShowAddDialog(false);
    setEditingAccount(null);
  }

  function openEdit(account: NetWorthAccount) {
    setEditingAccount(account);
    setFormName(account.name);
    setFormType(account.accountType);
    setFormBalance(account.balance.toString());
    setFormCurrency(account.currency || "USD");
    setFormNotes("");
    setShowAddDialog(true);
  }

  function handleSubmit() {
    if (!formName || !formBalance) return;
    const data = {
      name: formName,
      accountType: formType,
      balance: parseFloat(formBalance),
      currency: formCurrency,
    };

    if (editingAccount) {
      updateAccount.mutate({ id: editingAccount.id, data });
    } else {
      createAccount.mutate(data);
    }
  }

  const assets = accounts.filter((a) => a.accountType === "asset");
  const liabilities = accounts.filter((a) => a.accountType === "liability");

  const assetsByCurrency = new Map<string, number>();
  assets.forEach((a) => {
    const c = a.currency || "USD";
    assetsByCurrency.set(c, (assetsByCurrency.get(c) || 0) + a.balance);
  });

  const liabilitiesByCurrency = new Map<string, number>();
  liabilities.forEach((a) => {
    const c = a.currency || "USD";
    liabilitiesByCurrency.set(c, (liabilitiesByCurrency.get(c) || 0) + a.balance);
  });

  const allCurrencies = Array.from(
    new Set([...assetsByCurrency.keys(), ...liabilitiesByCurrency.keys()])
  ).sort();
  const mainCurrency = allCurrencies[0] || "USD";

  const totalAssets = assetsByCurrency.get(mainCurrency) || 0;
  const totalLiabilities = liabilitiesByCurrency.get(mainCurrency) || 0;
  const netWorth = totalAssets - totalLiabilities;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-3xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums" data-testid="text-total-assets">
              {formatCurrency(totalAssets, mainCurrency)}
            </div>
            {allCurrencies.filter(c => c !== mainCurrency).map(c => (
              <p key={c} className="text-xs text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                +{formatCurrency(assetsByCurrency.get(c) || 0, c)}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums" data-testid="text-total-liabilities">
              {formatCurrency(totalLiabilities, mainCurrency)}
            </div>
            {allCurrencies.filter(c => c !== mainCurrency).map(c => (
              <p key={c} className="text-xs text-red-600 dark:text-red-400 tabular-nums mt-0.5">
                +{formatCurrency(liabilitiesByCurrency.get(c) || 0, c)}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
            <Landmark className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold tabular-nums ${netWorth >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`} data-testid="text-net-worth">
              {formatCurrency(netWorth, mainCurrency)}
            </div>
            {allCurrencies.filter(c => c !== mainCurrency).map(c => {
              const nw = (assetsByCurrency.get(c) || 0) - (liabilitiesByCurrency.get(c) || 0);
              return (
                <p key={c} className={`text-xs tabular-nums mt-0.5 ${nw >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
                  {formatCurrency(nw, c)}
                </p>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Assets
          </h2>
          <span className="text-xs text-muted-foreground">{assets.length} accounts</span>
        </div>
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No asset accounts yet</p>
        ) : (
          <div className="space-y-1">
            {assets.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover-elevate"
                data-testid={`account-${account.id}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{account.name}</span>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                  {formatCurrency(account.balance, account.currency || "USD")}
                </span>
                <div className="flex items-center gap-0.5">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(account)} data-testid={`button-edit-account-${account.id}`}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteConfirmId(account.id)} data-testid={`button-delete-account-${account.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
            Liabilities
          </h2>
          <span className="text-xs text-muted-foreground">{liabilities.length} accounts</span>
        </div>
        {liabilities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No liability accounts yet</p>
        ) : (
          <div className="space-y-1">
            {liabilities.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover-elevate"
                data-testid={`account-${account.id}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{account.name}</span>
                </div>
                <span className="text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums shrink-0">
                  {formatCurrency(account.balance, account.currency || "USD")}
                </span>
                <div className="flex items-center gap-0.5">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(account)} data-testid={`button-edit-account-${account.id}`}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteConfirmId(account.id)} data-testid={`button-delete-account-${account.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={(open) => {
        if (!open) resetForm();
        else setShowAddDialog(true);
      }}>
        <DialogTrigger asChild>
          <Button className="w-full" data-testid="button-add-account" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Account
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Account" : "Add Account"}</DialogTitle>
            <DialogDescription>
              {editingAccount ? "Update your account details." : "Add a new asset or liability account to track your net worth."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Account name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              data-testid="input-account-name"
            />
            <Select value={formType} onValueChange={setFormType}>
              <SelectTrigger data-testid="select-account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="liability">Liability</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Balance"
              type="number"
              step="0.01"
              value={formBalance}
              onChange={(e) => setFormBalance(e.target.value)}
              data-testid="input-account-balance"
            />
            <Select value={formCurrency} onValueChange={setFormCurrency}>
              <SelectTrigger data-testid="select-account-currency">
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
            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={!formName || !formBalance || createAccount.isPending || updateAccount.isPending}
              data-testid="button-submit-account"
            >
              {createAccount.isPending || updateAccount.isPending ? "Saving..." : editingAccount ? "Update Account" : "Add Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => {
        if (!open) setDeleteConfirmId(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this account? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete-account">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteAccount.mutate(deleteConfirmId)}
              disabled={deleteAccount.isPending}
              data-testid="button-confirm-delete-account"
            >
              {deleteAccount.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
