import { useEffect, useRef, useState, useCallback } from "react";

const CORNERS = ["bottom-left", "bottom-right", "top-left", "top-right"];

export default function PeekingCreature({ glowRGB = "124,106,255", borderColor = "#7c6aff" }) {
  const [visible, setVisible]   = useState(false);
  const [corner, setCorner]     = useState("bottom-right");
  const [phase, setPhase]       = useState("hidden");
  const idleTimer  = useRef(null);
  const phaseTimer = useRef(null);

  // phase flow: hidden → sliding-in → peeking → looking-left → looking-right → looking-at-you → waving → sliding-out → hidden
  const runSequence = useCallback(() => {
    const c = CORNERS[Math.floor(Math.random() * CORNERS.length)];
    setCorner(c);
    setPhase("sliding-in");
    setVisible(true);

    phaseTimer.current = setTimeout(() => setPhase("peeking"),        700);
    phaseTimer.current = setTimeout(() => setPhase("looking-left"),  1400);
    phaseTimer.current = setTimeout(() => setPhase("looking-right"), 2200);
    phaseTimer.current = setTimeout(() => setPhase("looking-at-you"),3000);
    phaseTimer.current = setTimeout(() => setPhase("waving"),        3800);
    phaseTimer.current = setTimeout(() => setPhase("sliding-out"),   5600);
    phaseTimer.current = setTimeout(() => { setVisible(false); setPhase("hidden"); }, 6400);
  }, []);

  const scheduleNext = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(runSequence, 14000);
  }, [runSequence]);

  useEffect(() => {
    idleTimer.current = setTimeout(runSequence, 16000);
    const reset = () => {
      if (phase === "hidden") scheduleNext();
    };
    window.addEventListener("keydown", reset);
    window.addEventListener("click", reset);
    window.addEventListener("touchstart", reset);
    return () => {
      clearTimeout(idleTimer.current);
      clearTimeout(phaseTimer.current);
      window.removeEventListener("keydown", reset);
      window.removeEventListener("click", reset);
      window.removeEventListener("touchstart", reset);
    };
  }, [phase, runSequence, scheduleNext]);

  // schedule next after hiding
  useEffect(() => {
    if (phase === "hidden" && !visible) scheduleNext();
  }, [phase, visible, scheduleNext]);

  // corner position + slide direction
  const isRight  = corner === "bottom-right" || corner === "top-right";
  const isBottom = corner === "bottom-left"  || corner === "bottom-right";
  const isOut    = phase === "hidden" || phase === "sliding-out";
  const isIn     = phase === "sliding-in";

  // translate offsets
  const tx = isRight
    ? (isOut || isIn ? (isOut ? 100 : 100) : -8)
    : (isOut || isIn ? (isOut ? -100 : -100) : 8);
  const ty = isBottom
    ? (isOut || isIn ? 100 : -8)
    : (isOut || isIn ? -100 : 8);

  const posStyle = {
    position:   "fixed",
    zIndex:     999,
    width:      "100px",
    height:     "120px",
    pointerEvents: "none",
    transition: isOut ? "transform 0.5s cubic-bezier(0.4,0,0.8,0.6), opacity 0.4s ease"
                      : "transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease",
    opacity:    visible && phase !== "sliding-out" ? 1 : 0,
    transform:  `translate(${tx}%, ${ty}%)`,
    ...(isRight  ? { right: 0 } : { left: 0 }),
    ...(isBottom ? { bottom: 0 } : { top: 0 }),
  };

  // eye look directions
  const eyeOffset = phase === "looking-left"
    ? { lx: -4, ly: 0, rx: -4, ry: 0 }
    : phase === "looking-right"
    ? { lx: 4, ly: 0, rx: 4, ry: 0 }
    : phase === "looking-at-you" || phase === "waving"
    ? { lx: 0, ly: -2, rx: 0, ry: -2 }
    : { lx: 0, ly: 2, rx: 0, ry: 2 };

  const isWaving    = phase === "waving";
  const isHappy     = phase === "waving" || phase === "looking-at-you";
  const flipX       = isRight ? -1 : 1;
  const flipY       = isBottom ? 1 : -1;

  return (
    <div style={posStyle}>
      <svg
        viewBox="0 0 100 120"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: "100%", height: "100%",
          transform: `scale(${flipX}, ${flipY})`,
          filter: `drop-shadow(0 0 10px rgba(${glowRGB},0.5))`,
          overflow: "visible",
        }}
      >
        <defs>
          <radialGradient id="pc-body" cx="45%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#d580ff" />
            <stop offset="100%" stopColor="#7c3aed" />
          </radialGradient>
          <radialGradient id="pc-belly" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* HAND gripping edge */}
        <g>
          <path d="M 32 95 Q 16 88 8 78" stroke="#9d6fe8" strokeWidth="7" strokeLinecap="round" fill="none"/>
          <circle cx="7" cy="76" r="7" fill="#c084fc"/>
          <circle cx="1"  cy="69" r="3.5" fill="#c084fc"/>
          <circle cx="9"  cy="67" r="3.5" fill="#c084fc"/>
          <circle cx="15" cy="71" r="3" fill="#c084fc"/>
        </g>

        {/* BODY */}
        <ellipse cx="55" cy="88" rx="28" ry="26" fill="url(#pc-body)"/>
        <ellipse cx="55" cy="84" rx="15" ry="16" fill="url(#pc-belly)"/>

        {/* HEAD */}
        <circle cx="55" cy="55" r="32" fill="url(#pc-body)"/>

        {/* head shine */}
        <ellipse cx="44" cy="42" rx="11" ry="7" fill="rgba(255,255,255,0.2)" transform="rotate(-20,44,42)"/>

        {/* EARS */}
        <ellipse cx="33" cy="28" rx="7" ry="10" fill="#9b59d0" transform="rotate(-15,33,28)"/>
        <ellipse cx="77" cy="28" rx="7" ry="10" fill="#9b59d0" transform="rotate(15,77,28)"/>
        <ellipse cx="33" cy="28" rx="4"  cy2="28" ry="6"  fill="#e040fb" transform="rotate(-15,33,28)"/>
        <ellipse cx="77" cy="28" rx="4"  ry="6"  fill="#e040fb" transform="rotate(15,77,28)"/>

        {/* LEFT EYE */}
        <ellipse cx="43" cy="53" rx="9" ry={isHappy ? 6 : 10} fill="white"/>
        {!isHappy && <circle cx={43 + eyeOffset.lx} cy={53 + eyeOffset.ly} r="5.5" fill="#1a0a2e"/>}
        {!isHappy && <circle cx={44 + eyeOffset.lx} cy={51 + eyeOffset.ly} r="2" fill="white"/>}
        {isHappy && <path d="M 34 53 Q 43 46 52 53" stroke="#1a0a2e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>}

        {/* RIGHT EYE */}
        <ellipse cx="67" cy="53" rx="9" ry={isHappy ? 6 : 10} fill="white"/>
        {!isHappy && <circle cx={67 + eyeOffset.rx} cy={53 + eyeOffset.ry} r="5.5" fill="#1a0a2e"/>}
        {!isHappy && <circle cx={68 + eyeOffset.rx} cy={51 + eyeOffset.ry} r="2" fill="white"/>}
        {isHappy && <path d="M 58 53 Q 67 46 76 53" stroke="#1a0a2e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>}

        {/* MOUTH */}
        <path
          d={isHappy ? "M 44 67 Q 55 76 66 67" : "M 46 66 Q 55 72 64 66"}
          stroke="#1a0a2e" strokeWidth="2.5" fill="none" strokeLinecap="round"
        />

        {/* CHEEKS */}
        <ellipse cx="35" cy="62" rx="6" ry="4" fill="rgba(255,130,180,0.4)"/>
        <ellipse cx="75" cy="62" rx="6" ry="4" fill="rgba(255,130,180,0.4)"/>

        {/* WAVING ARM */}
        {isWaving && (
          <g style={{ transformOrigin: "75px 75px", animation: "peekWave 0.45s ease-in-out infinite alternate" }}>
            <path d="M 73 75 Q 85 58 90 44" stroke="#9b59d0" strokeWidth="7" strokeLinecap="round" fill="none"/>
            <circle cx="90" cy="42" r="7" fill="#c084fc"/>
            <circle cx="84" cy="34" r="3.5" fill="#c084fc"/>
            <circle cx="93" cy="33" r="3.5" fill="#c084fc"/>
            <circle cx="97" cy="40" r="3" fill="#c084fc"/>
          </g>
        )}

        {/* SPARKLES when waving */}
        {isWaving && (
          <>
            <text x="82" y="22" fontSize="11" style={{ animation: "peekFadeIn 0.3s ease" }}>✨</text>
            <text x="18" y="38" fontSize="9"  style={{ animation: "peekFadeIn 0.5s ease" }}>⭐</text>
            <text x="88" y="58" fontSize="8"  style={{ animation: "peekFadeIn 0.7s ease" }}>💫</text>
          </>
        )}

        {/* TAIL */}
        <path d="M 78 100 Q 94 108 90 118" stroke="#9b59d0" strokeWidth="6" strokeLinecap="round" fill="none"/>
        <circle cx="89" cy="119" r="5" fill="#c084fc"/>
      </svg>

      <style>{`
        @keyframes peekWave {
          from { transform: rotate(-18deg); }
          to   { transform: rotate(18deg); }
        }
        @keyframes peekFadeIn {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
