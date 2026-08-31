import { useEffect, useState } from "react";

// Ticks every second for countdowns and relative-time labels — separate
// from the 60s data poll, and the only thing allowed to animate.
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
