import { DevStatusBanner } from "./dev-status-banner";
import { DevRequestPanel } from "./dev-request-panel";
import { ReactQueryDevtoolsLoader } from "./react-query-devtools-loader";

export function DevTools() {
  if (!import.meta.env.DEV || !__DEV_TOOLS_ENABLED__) {
    return null;
  }

  return (
    <>
      <DevStatusBanner />
      <DevRequestPanel />
      <ReactQueryDevtoolsLoader />
    </>
  );
}
