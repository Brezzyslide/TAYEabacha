// client/src/lib/useBrowserTimezone.ts
import { useMemo } from "react";

export function useBrowserTimezone() {
  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);
  return tz;
}