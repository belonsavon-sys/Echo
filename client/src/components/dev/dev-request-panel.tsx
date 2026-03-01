import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ApiTrace = {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  atIso: string;
};

const EVENT_NAME = "echo:api-trace";

export function DevRequestPanel() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ApiTrace[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<ApiTrace>;
      if (!customEvent.detail) return;
      setRows((previous) => [customEvent.detail, ...previous].slice(0, 40));
    };

    window.addEventListener(EVENT_NAME, handler as EventListener);
    return () => {
      window.removeEventListener(EVENT_NAME, handler as EventListener);
    };
  }, []);

  const errorCount = useMemo(
    () => rows.filter((row) => row.status >= 400 || row.status === 0).length,
    [rows],
  );

  return (
    <div className="fixed bottom-3 right-3 z-50">
      <div className="rounded-md border bg-card shadow-md">
        <div className="flex items-center gap-2 px-2 py-1.5 border-b">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide API" : "Show API"}
          </Button>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{rows.length} requests</Badge>
          {errorCount > 0 ? (
            <Badge className="text-[10px] px-1.5 py-0 bg-red-600 text-white">{errorCount} errors</Badge>
          ) : null}
        </div>
        {open ? (
          <div className="w-[560px] max-w-[95vw] max-h-[45vh] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left font-medium px-2 py-1">Time</th>
                  <th className="text-left font-medium px-2 py-1">Method</th>
                  <th className="text-left font-medium px-2 py-1">Path</th>
                  <th className="text-left font-medium px-2 py-1">Status</th>
                  <th className="text-left font-medium px-2 py-1">Duration</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const statusClass =
                    row.status >= 500 || row.status === 0
                      ? "text-red-600 dark:text-red-400"
                      : row.status >= 400
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400";
                  return (
                    <tr key={`${row.atIso}-${index}`} className="border-t">
                      <td className="px-2 py-1 whitespace-nowrap">{new Date(row.atIso).toLocaleTimeString()}</td>
                      <td className="px-2 py-1">{row.method}</td>
                      <td className="px-2 py-1 font-mono truncate max-w-[260px]" title={row.url}>{row.url}</td>
                      <td className={`px-2 py-1 ${statusClass}`}>{row.status}</td>
                      <td className="px-2 py-1">{row.durationMs}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
