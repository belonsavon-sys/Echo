import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

function shortCommit(value: string): string {
  if (!value || value === "local") return value;
  return value.slice(0, 7);
}

export function DevStatusBanner() {
  const apiBase = typeof window !== "undefined" ? window.location.origin : "n/a";

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-[min(980px,96vw)]">
      <div className="rounded-md border bg-card/95 backdrop-blur px-3 py-2 shadow-md">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Badge variant="secondary">DEV</Badge>
          <span className="font-medium">Echo v{__APP_VERSION__}</span>
          <span className="text-muted-foreground">commit {shortCommit(__APP_COMMIT_SHA__)}</span>
          <span className="text-muted-foreground">auth {__AUTH_MODE__}</span>
          <span className="text-muted-foreground">api {apiBase}</span>
          <span className="text-muted-foreground">build {new Date(__APP_BUILD_TIME__).toLocaleString()}</span>
          <Link href="/dev/routes" className="ml-auto underline underline-offset-2 text-foreground">
            Route Explorer
          </Link>
        </div>
      </div>
    </div>
  );
}
