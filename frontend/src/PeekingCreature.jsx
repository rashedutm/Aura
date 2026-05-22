import { useEffect, useRef, useState, useCallback } from "react";
import { Player } from "@lottiefiles/react-lottie-player";
import peekUpAnim from "./peekUp.json";

const SIDES = ["bottom-left", "bottom-right"];
let lastSide = "";

export default function PeekingCreature({ glowRGB = "124,106,255" }) {
  const [visible, setVisible] = useState(false);
  const [side,    setSide]    = useState("bottom-left");
  const [entered, setEntered] = useState(false);
  const playerRef = useRef(null);
  const idleRef   = useRef(null);
  const t1 = useRef(null);
  const t2 = useRef(null);
  const t3 = useRef(null);
  const t4 = useRef(null);

  const clearAll = () => {
    [t1, t2, t3, t4].forEach(r => clearTimeout(r.current));
  };

  const run = useCallback(() => {
    clearAll();
    // always bottom, alternate left/right
    const next = lastSide === "bottom-left" ? "bottom-right" : "bottom-left";
    lastSide = next;
    setSide(next);
    setEntered(false);
    setVisible(true);

    // slide in
    t1.current = setTimeout(() => setEntered(true), 80);

    // play after slide in
    t2.current = setTimeout(() => {
      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current.play();
      }
    }, 900);

    // slide back out
    t3.current = setTimeout(() => setEntered(false), 5200);

    // hide fully
    t4.current = setTimeout(() => {
      setVisible(false);
    }, 5900);
  }, []);

  const schedule = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(run, 15000);
  }, [run]);

  useEffect(() => {
    idleRef.current = setTimeout(run, 18000);
    const reset = () => schedule();
    window.addEventListener("keydown",    reset);
    window.addEventListener("click",      reset);
    window.addEventListener("touchstart", reset);
    return () => {
      clearAll();
      clearTimeout(idleRef.current);
      window.removeEventListener("keydown",    reset);
      window.removeEventListener("click",      reset);
      window.removeEventListener("touchstart", reset);
    };
  }, [run, schedule]);

  useEffect(() => {
    if (!visible) schedule();
  }, [visible, schedule]);

  if (!visible) return null;

  const isRight = side === "bottom-right";

  // when not entered: push off bottom edge
  // when entered: sit at bottom with just head peeking
  const slideX = isRight
    ? (entered ? "0%" : "80%")
    : (entered ? "0%" : "-80%");
  const slideY = entered ? "30%" : "100%";

  return (
    <div style={{
      position:      "fixed",
      zIndex:        999,
      width:         "170px",
      height:        "170px",
      pointerEvents: "none",
      bottom:        0,
      ...(isRight ? { right: "20px" } : { left: "20px" }),
      transform:     `translate(${slideX}, ${slideY}) scaleX(${isRight ? -1 : 1})`,
      transition:    entered
        ? "transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease"
        : "transform 0.5s cubic-bezier(0.6,0,0.8,0.4), opacity 0.3s ease",
      opacity:       entered ? 1 : 0,
      filter:        `drop-shadow(0 0 12px rgba(${glowRGB},0.6))`,
    }}>
      <Player
        ref={playerRef}
        src={peekUpAnim}
        autoplay={false}
        loop={false}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
