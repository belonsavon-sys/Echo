import type { Entry, Category, Tag } from "@shared/schema";

export function exportBudgetToCSV(
  budgetName: string,
  entries: Entry[],
  categories: Category[],
  tags: Tag[]
) {
  const getCategoryName = (id: number | null) => {
    if (!id) return "";
    return categories.find(c => c.id === id)?.name || "";
  };

  const getTagNames = (tagIds: number[] | null) => {
    if (!tagIds || tagIds.length === 0) return "";
    return tagIds.map(id => tags.find(t => t.id === id)?.name || "").filter(Boolean).join("; ");
  };

  const headers = ["Date", "Type", "Name", "Amount", "Category", "Tags", "Status", "Note", "Recurring"];
  const rows = entries.map(e => [
    e.date,
    e.type,
    e.name,
    e.amount.toFixed(2),
    getCategoryName(e.categoryId),
    getTagNames(e.tagIds),
    e.isPaidOrReceived ? (e.type === "income" ? "Received" : "Paid") : "Pending",
    e.note || "",
    e.isRecurring ? e.recurringFrequency || "yes" : "no",
  ]);

  const totalIncome = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const totalExpenses = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);

  rows.push([]);
  rows.push(["", "", "Total Income", totalIncome.toFixed(2)]);
  rows.push(["", "", "Total Expenses", totalExpenses.toFixed(2)]);
  rows.push(["", "", "Balance", (totalIncome - totalExpenses).toFixed(2)]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map(cell => {
        const str = String(cell);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${budgetName.replace(/[^a-zA-Z0-9]/g, "_")}_budget.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
