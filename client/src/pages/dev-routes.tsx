import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type DevRoute = {
  method: string;
  path: string;
};

type DevRoutesResponse = {
  generatedAt: string;
  nodeEnv: string;
  authMode: "LOCAL_DEV_AUTH" | "SUPABASE_JWT";
  routeCount: number;
  routes: DevRoute[];
};

export default function DevRoutesPage() {
  const [filter, setFilter] = useState("");

  const { data, isLoading, error } = useQuery<DevRoutesResponse>({
    queryKey: ["/api/dev/routes"],
  });

  const filteredRoutes = useMemo(() => {
    if (!data?.routes) return [];
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return data.routes;
    return data.routes.filter((route) => {
      return (
        route.method.toLowerCase().includes(normalized) ||
        route.path.toLowerCase().includes(normalized)
      );
    });
  }, [data?.routes, filter]);

  return (
    <div className="h-full overflow-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold">Dev Route Explorer</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{data?.nodeEnv ?? "development"}</Badge>
          <Badge variant="secondary">auth {data?.authMode ?? __AUTH_MODE__}</Badge>
          <Badge variant="secondary">{data?.routeCount ?? 0} routes</Badge>
        </div>
      </div>

      <Input
        placeholder="Filter by method or path"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-8 rounded-md" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          Failed to load route explorer.
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-24">Method</th>
                <th className="text-left px-3 py-2 font-medium">Path</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoutes.map((route, index) => (
                <tr key={`${route.method}-${route.path}-${index}`} className="border-t">
                  <td className="px-3 py-2 font-mono">{route.method}</td>
                  <td className="px-3 py-2 font-mono break-all">{route.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRoutes.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">No routes matched your filter.</div>
          ) : null}
        </div>
      )}

      {data?.generatedAt ? (
        <p className="text-xs text-muted-foreground">
          Generated at {new Date(data.generatedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
