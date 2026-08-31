import { useEffect, useRef, useState } from "react";

// Real clip is 1.8s; loops roughly twice before fading into the dashboard.
// Shows on every full page load — no persistence.
const SPLASH_MS = 4000;
const FADE_MS = 500;

interface Props {
  onDone: () => void;
}

export function Splash({ onDone }: Props) {
  const [fadingOut, setFadingOut] = useState(false);

  // onDone is a fresh closure every time App re-renders (which useNow's 1s
  // tick causes constantly) — keeping it in a ref, not an effect's
  // dependency array, means these timers are set once and aren't
  // repeatedly cleared and restarted before they can ever fire.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const id = setTimeout(() => setFadingOut(true), SPLASH_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!fadingOut) return;
    const id = setTimeout(() => onDoneRef.current(), FADE_MS);
    return () => clearTimeout(id);
  }, [fadingOut]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      <video
        src="/xorome-video.mp4"
        poster="/videoframe_1054.png"
        autoPlay
        muted
        loop
        playsInline
        style={{ width: "min(70vw, 400px)", height: "min(70vw, 400px)", objectFit: "contain" }}
      />
    </div>
  );
}
