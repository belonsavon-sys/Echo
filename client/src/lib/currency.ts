export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
] as const;

export function getCurrencySymbol(currency: string): string {
  const found = CURRENCIES.find((c) => c.code === currency);
  return found ? found.symbol : currency;
}

export function formatNumber(
  value: number | string,
  options: Intl.NumberFormatOptions = {},
): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  const formatter = new Intl.NumberFormat("en-US", {
    useGrouping: true,
    ...options,
  });
  if (isNaN(num)) {
    return formatter.format(0);
  }
  return formatter.format(num);
}

export function formatCurrency(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const symbol = getCurrencySymbol(currency);
  const decimals = currency === "JPY" || currency === "KRW" ? 0 : 2;
  if (isNaN(num)) {
    return `${symbol}${formatNumber(0, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }
  const formatted = formatNumber(Math.abs(num), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = num < 0 ? "-" : "";
  return `${sign}${symbol}${formatted}`;
}
