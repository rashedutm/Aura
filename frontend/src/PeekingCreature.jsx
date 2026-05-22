import { useEffect, useRef, useState, useCallback } from "react";
import { Player } from "@lottiefiles/react-lottie-player";
import peekUpAnim from "./peekUp.json";
import peekDownAnim from "./peekDown.json";

const CORNERS = ["bottom-left", "bottom-right", "top-left", "top-right"];
let lastCornerIdx = -1;

export default function PeekingCreature({ glowRGB = "124,106,255" }) {
  const [visible, setVisible] = useState(false);
  const [corner,  setCorner]  = useState("bottom-left");
  const [entered, setEntered] = useState(false);
  const playerRef = useRef(null);
  const idleRef   = useRef(null);
  const t1 = useRef(null); const t2 = useRef(null);
  const t3 = useRef(null); const t4 = useRef(null);

  const clearAll = () => [t1,t2,t3,t4].forEach(r => clearTimeout(r.current));

  const run = useCallback(() => {
    clearAll();
    // pick different corner each time
    let idx;
    do { idx = Math.floor(Math.random() * 4); } while (idx === lastCornerIdx);
    lastCornerIdx = idx;
    const c = CORNERS[idx];
    setCorner(c);
    setEntered(false);
    setVisible(true);

    t1.current = setTimeout(() => setEntered(true), 100);
    t2.current = setTimeout(() => {
      if (playerRef.current) { playerRef.current.stop(); playerRef.current.play(); }
    }, 900);
    t3.current = setTimeout(() => setEntered(false), 5000);
    t4.current = setTimeout(() => setVisible(false), 5700);
  }, []);

  const schedule = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(run, 15000);
  }, [run]);

  useEffect(() => {
    idleRef.current = setTimeout(run, 18000);
    const reset = () => schedule();
    window.addEventListener("keydown", reset);
    window.addEventListener("click", reset);
    window.addEventListener("touchstart", reset);
    return () => {
      clearAll();
      clearTimeout(idleRef.current);
      window.removeEventListener("keydown", reset);
      window.removeEventListener("click", reset);
      window.removeEventListener("touchstart", reset);
    };
  }, [run, schedule]);

  useEffect(() => {
    if (!visible) schedule();
  }, [visible, schedule]);

  const isBottom = corner.startsWith("bottom");
  const isRight  = corner.endsWith("right");

  // slide: when not entered push fully off screen edge
  const slideX = isRight
    ? (entered ? "0%" : "120%")
    : (entered ? "0%" : "-120%");
  const slideY = isBottom
    ? (entered ? "0%" : "70%")
    : (entered ? "0%" : "-70%");

  return visible ? (
    <div style={{
      position:      "fixed",
      zIndex:        999,
      width:         "160px",
      height:        "160px",
      pointerEvents: "none",
      ...(isBottom ? { bottom: "-10px" } : { top: "-10px" }),
      ...(isRight  ? { right:  "-10px" } : { left: "-10px" }),
      transform:     `translate(${slideX}, ${slideY}) scaleX(${isRight ? -1 : 1})`,
      transition:    entered
        ? "transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease"
        : "transform 0.5s cubic-bezier(0.6,0,0.8,0.4), opacity 0.35s ease",
      opacity:       entered ? 1 : 0,
      filter:        `drop-shadow(0 0 12px rgba(${glowRGB},0.6))`,
    }}>
      <Player
        ref={playerRef}
        src={isBottom ? peekUpAnim : peekDownAnim}
        autoplay={false}
        loop={false}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  ) : null;
}
