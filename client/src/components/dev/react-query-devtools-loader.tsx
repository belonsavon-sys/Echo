import { useEffect, useState } from "react";
import type { ComponentType } from "react";

type DevtoolsProps = {
  initialIsOpen?: boolean;
  buttonPosition?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
};

export function ReactQueryDevtoolsLoader() {
  const [Component, setComponent] = useState<ComponentType<DevtoolsProps> | null>(null);

  useEffect(() => {
    let active = true;
    if (!import.meta.env.DEV) return () => {
      active = false;
    };

    import("@tanstack/react-query-devtools")
      .then((mod) => {
        if (!active) return;
        setComponent(() => mod.ReactQueryDevtools as ComponentType<DevtoolsProps>);
      })
      .catch(() => {
        // Keep app functional even if devtools chunk fails.
      });

    return () => {
      active = false;
    };
  }, []);

  if (!Component) return null;
  return <Component initialIsOpen={false} buttonPosition="bottom-left" />;
}
