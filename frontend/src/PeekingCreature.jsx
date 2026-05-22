import { useEffect, useRef, useState, useCallback } from "react";
import { Player } from "@lottiefiles/react-lottie-player";
import peekUpAnim   from "./peekUp.json";
import peekDownAnim from "./peekDown.json";

const CORNERS = ["bottom-left", "bottom-right", "top-left", "top-right"];

// tracks last corner to avoid repeating
let lastCorner = "";

function pickCorner() {
  const available = CORNERS.filter(c => c !== lastCorner);
  const picked = available[Math.floor(Math.random() * available.length)];
  lastCorner = picked;
  return picked;
}

export default function PeekingCreature({ glowRGB = "124,106,255" }) {
  const [show,   setShow]   = useState(false);
  const [corner, setCorner] = useState("bottom-left");
  const [phase,  setPhase]  = useState("out"); // out | in | jumping-out
  const playerRef = useRef(null);
  const timers    = useRef([]);
  const idleRef   = useRef(null);

  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const after = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };

  const runSequence = useCallback(() => {
    clearAll();
    const c = pickCorner();
    setCorner(c);
    setPhase("out");
    setShow(true);

    // small delay then slide in
    after(() => setPhase("in"), 80);

    // play animation after slide-in
    after(() => {
      if (playerRef.current) { playerRef.current.stop(); playerRef.current.play(); }
    }, 850);

    // jump back out (same corner it came from)
    after(() => setPhase("jumping-out"), 5000);

    // hide after jump completes
    after(() => { setShow(false); setPhase("out"); }, 5700);
  }, []);

  const scheduleNext = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(runSequence, 14000);
  }, [runSequence]);

  useEffect(() => {
    idleRef.current = setTimeout(runSequence, 16000);
    const act = () => { if (phase === "out" && !show) scheduleNext(); };
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
  }, [phase, show, runSequence, scheduleNext]);

  useEffect(() => {
    if (!show && phase === "out") scheduleNext();
  }, [show, phase, scheduleNext]);

  if (!show) return null;

  const isBottom = corner === "bottom-left" || corner === "bottom-right";
  const isRight  = corner === "bottom-right" || corner === "top-right";
  const isIn     = phase === "in";
  const isJumpOut = phase === "jumping-out";

  // slide values: when out/jumping-out push off screen, when in = 0
  const offX = isRight ? "110%" : "-110%";
  const offY = isBottom ? "65%"  : "-65%";

  const tx = isIn ? "0%" : offX;
  const ty = isIn ? "0%" : offY;

  // jump-out uses fast bouncy ease, slide-in uses spring, hidden = instant
  const transition = isJumpOut
    ? "transform 0.5s cubic-bezier(0.55,0,0.7,0.4), opacity 0.3s ease 0.1s"
    : isIn
    ? "none"
    : "transform 0.65s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease";

  // pupils look up for bottom, down for top
  const animSrc = isBottom ? peekUpAnim : peekDownAnim;

  return (
    <div style={{
      position:      "fixed",
      zIndex:        999,
      width:         "160px",
      height:        "160px",
      pointerEvents: "none",
      ...(isBottom ? { bottom: 0 } : { top:   0 }),
      ...(isRight  ? { right:  0 } : { left:  0 }),
      transform:  `translate(${tx}, ${ty}) scaleX(${isRight ? -1 : 1})`,
      transition,
      opacity:    isIn ? 1 : 0,
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
