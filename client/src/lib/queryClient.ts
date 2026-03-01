import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAccessToken } from "./supabase";

const API_TRACE_EVENT_NAME = "echo:api-trace";

type ApiTracePayload = {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  atIso: string;
};

function emitApiTrace(payload: ApiTracePayload): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ApiTracePayload>(API_TRACE_EVENT_NAME, { detail: payload }));
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const startedAt = performance.now();
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  } catch (error) {
    emitApiTrace({
      method,
      url,
      status: 0,
      durationMs: Math.round(performance.now() - startedAt),
      atIso: new Date().toISOString(),
    });
    throw error;
  }

  emitApiTrace({
    method,
    url,
    status: res.status,
    durationMs: Math.round(performance.now() - startedAt),
    atIso: new Date().toISOString(),
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const startedAt = performance.now();
    const url = queryKey.join("/") as string;
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        headers,
        credentials: "include",
      });
    } catch (error) {
      emitApiTrace({
        method: "GET",
        url,
        status: 0,
        durationMs: Math.round(performance.now() - startedAt),
        atIso: new Date().toISOString(),
      });
      throw error;
    }

    emitApiTrace({
      method: "GET",
      url,
      status: res.status,
      durationMs: Math.round(performance.now() - startedAt),
      atIso: new Date().toISOString(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
