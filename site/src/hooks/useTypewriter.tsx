import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// Sections that carry typed prose, in document order. Vitals, Intake, and
// FindMe have no prose (numbers, labels, titles, pills only) so they never
// appear here — they're simply not part of the sequence.
export type TypewriterSection = "header" | "now" | "said" | "purpose" | "ledger" | "footer";

const SECTION_ORDER: TypewriterSection[] = ["header", "now", "said", "purpose", "ledger", "footer"];
const SECTION_PAUSE_MS = 120;
const STORAGE_KEY = "xorome-typewriter-seen";
// Generous upper bound so a miscounted item total (a section reporting N
// items but rendering fewer) can never leave the page stuck mid-reveal.
const MAX_REVEAL_MS = 10_000;

interface Position {
  section: number;
  item: number;
}

interface TypewriterContextValue {
  skip: boolean;
  isActive: (section: TypewriterSection, item: number) => boolean;
  isPast: (section: TypewriterSection, item: number) => boolean;
  advance: (section: TypewriterSection, item: number, itemCount: number) => void;
}

const TypewriterContext = createContext<TypewriterContextValue | null>(null);

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function hasSeenThisSession(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Private browsing / storage disabled — worst case it replays next load.
  }
}

export function TypewriterProvider({ children }: { children: ReactNode }) {
  const [skip, setSkip] = useState(() => prefersReducedMotion() || hasSeenThisSession());
  const [position, setPosition] = useState<Position>({ section: 0, item: 0 });

  useEffect(() => {
    if (skip) return;
    const handler = () => setSkip(true);
    document.addEventListener("pointerdown", handler, { once: true });
    return () => document.removeEventListener("pointerdown", handler);
  }, [skip]);

  useEffect(() => {
    if (skip) return;
    const id = setTimeout(() => setSkip(true), MAX_REVEAL_MS);
    return () => clearTimeout(id);
  }, [skip]);

  useEffect(() => {
    if (skip || position.section >= SECTION_ORDER.length) markSeen();
  }, [skip, position]);

  const isActive = useCallback(
    (section: TypewriterSection, item: number) => {
      if (skip) return false;
      const idx = SECTION_ORDER.indexOf(section);
      return position.section === idx && position.item === item;
    },
    [skip, position]
  );

  const isPast = useCallback(
    (section: TypewriterSection, item: number) => {
      if (skip) return true;
      const idx = SECTION_ORDER.indexOf(section);
      return position.section > idx || (position.section === idx && position.item > item);
    },
    [skip, position]
  );

  const advance = useCallback((section: TypewriterSection, item: number, itemCount: number) => {
    const idx = SECTION_ORDER.indexOf(section);
    setPosition((prev) => {
      if (prev.section !== idx || prev.item !== item) return prev; // stale call, ignore
      if (item + 1 < itemCount) {
        return { section: idx, item: item + 1 };
      }
      setTimeout(() => {
        setPosition((p2) => (p2.section === idx ? { section: idx + 1, item: 0 } : p2));
      }, SECTION_PAUSE_MS);
      return prev;
    });
  }, []);

  return (
    <TypewriterContext.Provider value={{ skip, isActive, isPast, advance }}>
      {children}
    </TypewriterContext.Provider>
  );
}

export interface TypewriterSlot {
  active: boolean;
  past: boolean;
  skip: boolean;
  onDone: () => void;
}

// One call per rendered prose item, in document order within its section.
// itemCount must exactly match how many items that section renders for the
// current data — a mismatch stalls the sequence until MAX_REVEAL_MS forces
// it through.
export function useTypewriterSlot(section: TypewriterSection, item: number, itemCount: number): TypewriterSlot {
  const ctx = useContext(TypewriterContext);
  const onDone = useCallback(() => {
    ctx?.advance(section, item, itemCount);
  }, [ctx, section, item, itemCount]);

  if (!ctx) {
    return { active: false, past: true, skip: true, onDone };
  }
  return { active: ctx.isActive(section, item), past: ctx.isPast(section, item), skip: ctx.skip, onDone };
}
