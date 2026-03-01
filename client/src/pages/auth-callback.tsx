import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type CallbackState = {
  status: "loading" | "error";
  message?: string;
};

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<CallbackState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function runCallback() {
      try {
        const url = new URL(window.location.href);
        const errorDescription = url.searchParams.get("error_description");
        if (errorDescription) {
          throw new Error(errorDescription);
        }

        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.getSession();
          if (error) throw error;
        }

        if (!cancelled) {
          setLocation("/");
        }
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          message: (error as Error)?.message || "Unable to complete sign in.",
        });
      }
    }

    runCallback();

    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  if (state.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Completing sign in...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="max-w-sm rounded-md border bg-card p-4 text-sm">
        <p className="font-medium text-destructive">Sign-in callback failed</p>
        <p className="mt-2 text-muted-foreground">{state.message}</p>
        <button
          type="button"
          className="mt-3 text-primary underline"
          onClick={() => setLocation("/")}
          data-testid="button-auth-callback-retry"
        >
          Return to home
        </button>
      </div>
    </div>
  );
}
