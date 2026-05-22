import { useEffect, useRef, useState, useCallback } from "react";
import { Player } from "@lottiefiles/react-lottie-player";
import peekAnimation from "./peek.json";

const CORNERS = ["bottom-left", "bottom-right", "top-left", "top-right"];

export default function PeekingCreature({ glowRGB = "124,106,255" }) {
  const [visible, setVisible] = useState(false);
  const [corner, setCorner]   = useState("bottom-right");
  const [sliding, setSliding] = useState(false);
  const playerRef  = useRef(null);
  const idleTimer  = useRef(null);
  const seqTimers  = useRef([]);

  const clearSeq = () => seqTimers.current.forEach(clearTimeout);

  const addTimer = (fn, delay) => {
    const t = setTimeout(fn, delay);
    seqTimers.current.push(t);
  };

  const runSequence = useCallback(() => {
    clearSeq();
    const c = CORNERS[Math.floor(Math.random() * CORNERS.length)];
    setCorner(c);
    setSliding(false);
    setVisible(true);

    // play animation
    addTimer(() => {
      if (playerRef.current) playerRef.current.play();
    }, 100);

    // slide out after animation plays (animation is ~4s at 30fps = 119 frames)
    addTimer(() => {
      setSliding(true);
    }, 4200);

    addTimer(() => {
      setVisible(false);
      setSliding(false);
      if (playerRef.current) playerRef.current.stop();
    }, 4900);
  }, []);

  const scheduleNext = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(runSequence, 14000);
  }, [runSequence]);

  useEffect(() => {
    // first appearance after 16s
    idleTimer.current = setTimeout(runSequence, 16000);

    const onActivity = () => scheduleNext();
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click",   onActivity);
    window.addEventListener("touchstart", onActivity);

    return () => {
      clearTimeout(idleTimer.current);
      clearSeq();
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click",   onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
  }, [runSequence, scheduleNext]);

  // schedule next after hiding
  useEffect(() => {
    if (!visible) scheduleNext();
  }, [visible, scheduleNext]);

  // position per corner
  const isRight  = corner === "bottom-right" || corner === "top-right";
  const isBottom = corner === "bottom-left"  || corner === "bottom-right";

  // slide offsets — when sliding out or not visible, push off screen
  const isOut = !visible || sliding;
  const tx = isRight  ? (isOut ? "110%" : "-5%") : (isOut ? "-110%" : "5%");
  const ty = isBottom ? (isOut ? "60%"  : "-5%") : (isOut ? "-60%"  : "5%");

  const posStyle = {
    position:   "fixed",
    zIndex:     999,
    width:      "160px",
    height:     "160px",
    pointerEvents: "none",
    opacity:    visible && !sliding ? 1 : 0,
    transform:  `translate(${tx}, ${ty})`,
    transition: sliding
      ? "transform 0.5s cubic-bezier(0.4,0,0.8,0.6), opacity 0.35s ease"
      : "transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease",
    filter:     `drop-shadow(0 0 14px rgba(${glowRGB},0.55))`,
    ...(isRight  ? { right: 0 } : { left: 0 }),
    ...(isBottom ? { bottom: 0 } : { top: 0 }),
    // flip horizontally for right-side corners so character faces inward
    ...(isRight ? { transform: `scaleX(-1) translate(${tx}, ${ty})` } : {}),
  };

  if (!visible) return null;

  return (
    <div style={posStyle}>
      <Player
        ref={playerRef}
        src={peekAnimation}
        autoplay={false}
        loop={false}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
