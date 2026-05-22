import { useEffect, useRef, useState, useCallback } from "react";
import { Player } from "@lottiefiles/react-lottie-player";
import peekAnimation from "./peek.json";

const CORNERS = ["bottom-left", "bottom-right", "top-left", "top-right"];

// rotation so eyes always face screen center
// character naturally looks up-right, so:
// bottom-left  → 0deg   (looks up toward center)
// bottom-right → 90deg  (flip: looks up-left toward center)
// top-left     → -90deg (looks down toward center)
// top-right    → 180deg (looks down, flipped)
const CORNER_CONFIG = {
  "bottom-left":  { bottom: 0, left:  0, rotate:   0, scaleX:  1 },
  "bottom-right": { bottom: 0, right: 0, rotate:   0, scaleX: -1 },
  "top-left":     { top:    0, left:  0, rotate: 180, scaleX: -1 },
  "top-right":    { top:    0, right: 0, rotate: 180, scaleX:  1 },
};

export default function PeekingCreature({ glowRGB = "124,106,255" }) {
  const [visible, setVisible] = useState(false);
  const [corner, setCorner]   = useState("bottom-left");
  const [phase, setPhase]     = useState("out"); // out | sliding-in | in | sliding-out
  const playerRef = useRef(null);
  const idleTimer = useRef(null);
  const seqTimers = useRef([]);

  const clearSeq = () => {
    seqTimers.current.forEach(clearTimeout);
    seqTimers.current = [];
  };

  const addTimer = (fn, delay) => {
    const t = setTimeout(fn, delay);
    seqTimers.current.push(t);
    return t;
  };

  const runSequence = useCallback(() => {
    clearSeq();
    const c = CORNERS[Math.floor(Math.random() * CORNERS.length)];
    setCorner(c);
    setVisible(true);
    setPhase("sliding-in");

    // after slide-in transition completes, mark as fully in
    addTimer(() => {
      setPhase("in");
      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current.play();
      }
    }, 750);

    // start slide-out after animation (~4s)
    addTimer(() => {
      setPhase("sliding-out");
    }, 4800);

    // fully hidden after slide-out transition
    addTimer(() => {
      setPhase("out");
      setVisible(false);
      if (playerRef.current) playerRef.current.stop();
    }, 5500);
  }, []);

  const scheduleNext = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(runSequence, 14000);
  }, [runSequence]);

  useEffect(() => {
    idleTimer.current = setTimeout(runSequence, 16000);
    const onActivity = () => {
      if (phase === "out") scheduleNext();
    };
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("touchstart", onActivity);
    return () => {
      clearTimeout(idleTimer.current);
      clearSeq();
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
  }, [phase, runSequence, scheduleNext]);

  useEffect(() => {
    if (phase === "out" && !visible) scheduleNext();
  }, [phase, visible, scheduleNext]);

  if (!visible) return null;

  const cfg = CORNER_CONFIG[corner];
  const isIn  = phase === "in";
  const isOut = phase === "out" || phase === "sliding-out";

  // slide offset: push off screen when out, pull in when visible
  // use translate on the axis away from the corner
  const slideOut = isOut ? "130%" : "0%";
  const slideIn  = isIn || phase === "sliding-in" ? "0%" : "130%";
  const slideVal = isOut ? slideOut : slideIn;

  // direction to slide: bottom corners slide down, top corners slide up
  // left corners slide left, right corners slide right
  const isBottom = "bottom" in cfg;
  const isRight  = "right" in cfg;

  // translate away from screen
  const txOut = isRight ? slideVal : `-${slideVal}`;
  const tyOut = isBottom ? slideVal : `-${slideVal}`;

  // when fully in, no translate
  const tx = isIn ? "0%" : txOut;
  const ty = isIn ? "0%" : tyOut;

  const transition = phase === "sliding-in"
    ? "transform 0.65s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease"
    : phase === "sliding-out"
    ? "transform 0.55s cubic-bezier(0.4,0,1,1), opacity 0.35s ease"
    : "none";

  const wrapperStyle = {
    position: "fixed",
    zIndex: 999,
    width: "160px",
    height: "160px",
    pointerEvents: "none",
    ...("bottom" in cfg ? { bottom: 0 } : { top: 0 }),
    ...("left"   in cfg ? { left:  0 } : { right: 0 }),
    transition,
    transform: `translate(${tx}, ${ty})`,
    opacity: isOut ? 0 : 1,
    filter: `drop-shadow(0 0 14px rgba(${glowRGB},0.6))`,
  };

  // inner rotation + flip so eyes face screen center
  const innerStyle = {
    width: "100%",
    height: "100%",
    transform: `scaleX(${cfg.scaleX}) rotate(${cfg.rotate}deg)`,
    transformOrigin: "center center",
  };

  return (
    <div style={wrapperStyle}>
      <div style={innerStyle}>
        <Player
          ref={playerRef}
          src={peekAnimation}
          autoplay={false}
          loop={false}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
