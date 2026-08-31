import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchEventsByIds,
  fetchLatestEvent,
  fetchLedger,
  fetchPosts,
  fetchSessionEvents,
  fetchSessions,
} from "../lib/queries";
import type { PublicEvent, PublicLedgerEntry, PublicPost, PublicSession } from "../lib/types";
import { latestSession } from "../lib/derive";

const POLL_MS = 60_000;

interface SiteDataState {
  sessions: PublicSession[];
  latestEvent: PublicEvent | null;
  latestSessionEvents: PublicEvent[];
  ledger: PublicLedgerEntry[];
  posts: PublicPost[];
  postSourceEvents: Map<string, PublicEvent>;
}

export interface SiteData extends SiteDataState {
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: SiteDataState = {
  sessions: [],
  latestEvent: null,
  latestSessionEvents: [],
  ledger: [],
  posts: [],
  postSourceEvents: new Map(),
};

// Fetches every section's data on mount and every 60s after. On a failed
// poll, keeps whatever was last successfully loaded rather than clearing
// the page — a transient network error shouldn't make honest data look
// like an empty state.
export function useSiteData(): SiteData {
  const [state, setState] = useState<SiteDataState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      const [sessions, latestEvent, ledger, posts] = await Promise.all([
        fetchSessions(),
        fetchLatestEvent(),
        fetchLedger(),
        fetchPosts(),
      ]);

      const latest = latestSession(sessions);
      const latestSessionEvents = latest ? await fetchSessionEvents(latest.id) : [];

      const allEventIds = [...new Set(posts.flatMap((p) => p.event_ids))];
      const sourceEvents = await fetchEventsByIds(allEventIds);
      const postSourceEvents = new Map(sourceEvents.map((e) => [e.id, e]));

      setState({ sessions, latestEvent, latestSessionEvents, ledger, posts, postSourceEvents });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return { ...state, loading, error };
}
