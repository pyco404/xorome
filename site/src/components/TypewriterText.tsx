import { useEffect, useRef, useState } from "react";
import type { TypewriterSlot } from "../hooks/useTypewriter";

interface Props extends TypewriterSlot {
  text: string;
  charDelayMs?: number;
}

const DEFAULT_CHAR_DELAY_MS = 8;

// Renders `text` character by character once `active`. A hidden full-text
// ghost, stacked in the same grid cell as the visible partial text, reserves
// final height/width from the very first render — the box never grows as
// characters are added, and it's already reserved even before this slot's
// turn comes. `inline-grid` (not `grid`) so this sits inline with adjacent
// content (e.g. Now's trailing "— 5m ago") instead of forcing a line break.
export function TypewriterText({ text, active, past, skip, onDone, charDelayMs = DEFAULT_CHAR_DELAY_MS }: Props) {
  const revealed = skip || past;
  const [count, setCount] = useState(revealed ? text.length : 0);
  const doneFiredRef = useRef(false);

  useEffect(() => {
    if (revealed) {
      setCount(text.length);
      return;
    }
    if (!active) {
      setCount(0);
      doneFiredRef.current = false;
      return;
    }
    if (count >= text.length) {
      if (!doneFiredRef.current) {
        doneFiredRef.current = true;
        onDone();
      }
      return;
    }
    const id = setTimeout(() => setCount((c) => c + 1), charDelayMs);
    return () => clearTimeout(id);
  }, [active, revealed, count, text, onDone, charDelayMs]);

  return (
    <span style={{ display: "inline-grid" }}>
      <span aria-hidden="true" style={{ visibility: "hidden", gridArea: "1 / 1", whiteSpace: "pre-wrap" }}>
        {text}
      </span>
      <span style={{ gridArea: "1 / 1", whiteSpace: "pre-wrap" }}>{revealed ? text : text.slice(0, count)}</span>
    </span>
  );
}
