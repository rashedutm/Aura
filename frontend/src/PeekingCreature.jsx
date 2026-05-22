import { useEffect, useRef, useState, useCallback } from "react";
import { Player } from "@lottiefiles/react-lottie-player";
import peekUpAnim   from "./peekUp.json";
import peekDownAnim from "./peekDown.json";

const CORNERS = ["bottom-left", "bottom-right", "top-left", "top-right"];

export default function PeekingCreature({ glowRGB = "124,106,255" }) {
  const [show,   setShow]   = useState(false);
  const [corner, setCorner] = useState("bottom-left");
  const [out,    setOut]    = useState(true);
  const playerRef = useRef(null);
  const timers    = useRef([]);
  const idleRef   = useRef(null);

  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const after = (fn, ms) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  };

  const runSequence = useCallback(() => {
    clearAll();
    const c = CORNERS[Math.floor(Math.random() * CORNERS.length)];
    setCorner(c);
    setOut(true);
    setShow(true);

    // slide in
    after(() => setOut(false), 50);

    // play animation after slide in completes
    after(() => {
      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current.play();
      }
    }, 800);

    // slide out
    after(() => setOut(true), 5200);

    // hide completely
    after(() => setShow(false), 5900);
  }, []);

  const scheduleNext = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(runSequence, 14000);
  }, [runSequence]);

  useEffect(() => {
    idleRef.current = setTimeout(runSequence, 16000);
    const act = () => scheduleNext();
    window.addEventListener("keydown",    act);
    window.addEventListener("click",      act);
    window.addEventListener("touchstart", act);
    return () => {
      clearTimeout(idleRef.current);
      clearAll();
      window.removeEventListener("keydown",    act);
      window.removeEventListener("click",      act);
      window.removeEventListener("touchstart", act);
    };
  }, [runSequence, scheduleNext]);

  useEffect(() => {
    if (!show) scheduleNext();
  }, [show, scheduleNext]);

  if (!show) return null;

  const isBottom = corner === "bottom-left" || corner === "bottom-right";
  const isRight  = corner === "bottom-right" || corner === "top-right";

  // pupils look UP for bottom corners, DOWN for top corners
  const animSrc = isBottom ? peekUpAnim : peekDownAnim;

  // slide direction — push off screen edge when out
  const slideX = isRight ? (out ? "100%" : "0%") : (out ? "-100%" : "0%");
  const slideY = isBottom ? (out ? "60%"  : "0%") : (out ? "-60%"  : "0%");

  return (
    <div style={{
      position:   "fixed",
      zIndex:     999,
      width:      "160px",
      height:     "160px",
      pointerEvents: "none",
      ...(isBottom ? { bottom: 0 } : { top: 0 }),
      ...(isRight  ? { right:  0 } : { left: 0 }),
      transform:  `translate(${slideX}, ${slideY}) scaleX(${isRight ? -1 : 1})`,
      transition: out
        ? "transform 0.55s cubic-bezier(0.55,0,1,0.45), opacity 0.3s ease"
        : "transform 0.65s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease",
      opacity:    out ? 0 : 1,
      filter:     `drop-shadow(0 0 14px rgba(${glowRGB},0.6))`,
    }}>
      <Player
        ref={playerRef}
        src={animSrc}
        autoplay={false}
        loop={false}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
