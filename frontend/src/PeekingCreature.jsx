import { useEffect, useRef, useState, useCallback } from "react";

// picks a random corner each time
const CORNERS = ["bottom-left", "bottom-right", "top-left", "top-right"];

function getCornerStyle(corner, visible) {
  const base = {
    position: "fixed",
    zIndex: 999,
    pointerEvents: "none",
    width: "90px",
    height: "110px",
    transition: "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease",
  };

  const transforms = {
    "bottom-left":  { bottom: 0, left: 0,  transformOrigin: "bottom left",  transform: visible ? "translate(8px, -8px)"  : "translate(-80px, 80px)" },
    "bottom-right": { bottom: 0, right: 0, transformOrigin: "bottom right", transform: visible ? "translate(-8px, -8px)" : "translate(80px, 80px)"  },
    "top-left":     { top: 0,    left: 0,  transformOrigin: "top left",     transform: visible ? "translate(8px, 8px)"   : "translate(-80px, -80px)"},
    "top-right":    { top: 0,    right: 0, transformOrigin: "top right",    transform: visible ? "translate(-8px, 8px)"  : "translate(80px, -80px)" },
  };

  return { ...base, ...transforms[corner], opacity: visible ? 1 : 0 };
}

export default function PeekingCreature({ glowRGB = "124,106,255", borderColor = "#7c6aff" }) {
  const [visible, setVisible] = useState(false);
  const [corner, setCorner] = useState("bottom-right");
  const [phase, setPhase] = useState("idle"); // idle | peeking | waving | hiding
  const idleTimer = useRef(null);
  const phaseTimer = useRef(null);

  const startSequence = useCallback(() => {
    // pick random corner
    const c = CORNERS[Math.floor(Math.random() * CORNERS.length)];
    setCorner(c);
    setPhase("peeking");
    setVisible(true);

    // wave after 0.8s
    phaseTimer.current = setTimeout(() => {
      setPhase("waving");

      // hide after 2s of waving
      phaseTimer.current = setTimeout(() => {
        setPhase("hiding");
        setVisible(false);

        // reset phase after hide animation
        phaseTimer.current = setTimeout(() => {
          setPhase("idle");
        }, 700);
      }, 2000);
    }, 800);
  }, []);

  const resetIdleTimer = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearTimeout(phaseTimer.current);
    if (visible) {
      setVisible(false);
      setPhase("idle");
    }
    // appear after 12 seconds of no typing
    idleTimer.current = setTimeout(() => {
      startSequence();
    }, 12000);
  }, [visible, startSequence]);

  useEffect(() => {
    // start initial timer
    idleTimer.current = setTimeout(startSequence, 15000);

    const handleActivity = () => resetIdleTimer();
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("touchstart", handleActivity);

    return () => {
      clearTimeout(idleTimer.current);
      clearTimeout(phaseTimer.current);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [resetIdleTimer, startSequence]);

  // which corner determines flip
  const flipX = corner === "bottom-right" || corner === "top-right" ? -1 : 1;
  const flipY = corner === "top-left" || corner === "top-right" ? -1 : 1;

  return (
    <div style={getCornerStyle(corner, visible)}>
      <svg
        viewBox="0 0 90 110"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${flipX}, ${flipY})`,
          filter: `drop-shadow(0 0 12px rgba(${glowRGB},0.6))`,
          overflow: "visible",
        }}
      >
        <defs>
          <radialGradient id="bodyGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#7c6aff" />
          </radialGradient>
          <radialGradient id="bellyGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* HAND on edge (always visible as part of peek) */}
        <g style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease" }}>
          {/* arm */}
          <path
            d="M 30 85 Q 15 80 8 72"
            stroke="#9d6fe8"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          {/* hand/paw */}
          <circle cx="8" cy="70" r="7" fill="#c084fc" />
          {/* fingers */}
          <circle cx="3"  cy="64" r="3.5" fill="#c084fc" />
          <circle cx="10" cy="62" r="3.5" fill="#c084fc" />
          <circle cx="16" cy="65" r="3" fill="#c084fc" />
        </g>

        {/* BODY — cute blob */}
        <ellipse
          cx="52"
          cy="72"
          rx="30"
          ry="32"
          fill="url(#bodyGrad)"
          filter="url(#glow)"
        />

        {/* belly shine */}
        <ellipse cx="52" cy="68" rx="16" ry="18" fill="url(#bellyGrad)" />

        {/* HEAD */}
        <circle
          cx="52"
          cy="46"
          r="28"
          fill="url(#bodyGrad)"
          filter="url(#glow)"
        />

        {/* head shine */}
        <ellipse cx="44" cy="36" rx="10" ry="7" fill="rgba(255,255,255,0.18)" transform="rotate(-20,44,36)" />

        {/* EYES */}
        {/* left eye white */}
        <ellipse cx="42" cy="44" rx="8" ry="9" fill="white" />
        {/* right eye white */}
        <ellipse cx="62" cy="44" rx="8" ry="9" fill="white" />
        {/* left pupil */}
        <circle cx="43" cy="46" r="5" fill="#1a1040" />
        {/* right pupil */}
        <circle cx="63" cy="46" r="5" fill="#1a1040" />
        {/* left eye shine */}
        <circle cx="45" cy="43" r="2" fill="white" />
        {/* right eye shine */}
        <circle cx="65" cy="43" r="2" fill="white" />
        {/* left eye blink line (shown when waving) */}
        {phase === "waving" && (
          <path d="M 35 44 Q 42 38 49 44" stroke="#1a1040" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
        {phase === "waving" && (
          <path d="M 55 44 Q 62 38 69 44" stroke="#1a1040" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}

        {/* SMILE */}
        <path
          d={phase === "waving" ? "M 42 56 Q 52 64 62 56" : "M 44 55 Q 52 61 60 55"}
          stroke="#1a1040"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* CHEEK BLUSH */}
        <ellipse cx="36" cy="52" rx="6" ry="4" fill="rgba(255,150,180,0.35)" />
        <ellipse cx="68" cy="52" rx="6" ry="4" fill="rgba(255,150,180,0.35)" />

        {/* EARS / HORNS */}
        <ellipse cx="34" cy="22" rx="7" ry="10" fill="#9d6fe8" transform="rotate(-15,34,22)" />
        <ellipse cx="70" cy="22" rx="7" ry="10" fill="#9d6fe8" transform="rotate(15,70,22)" />
        <ellipse cx="34" cy="22" rx="4" ry="6"  fill="#e040fb" transform="rotate(-15,34,22)" />
        <ellipse cx="70" cy="22" rx="4" ry="6"  fill="#e040fb" transform="rotate(15,70,22)" />

        {/* WAVING ARM (only during wave phase) */}
        {(phase === "waving") && (
          <g style={{ transformOrigin: "70px 65px", animation: "wave 0.5s ease-in-out 3" }}>
            <path
              d="M 70 65 Q 82 50 88 38"
              stroke="#9d6fe8"
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
              style={{ animation: "waveArm 0.5s ease-in-out infinite alternate" }}
            />
            <circle cx="88" cy="36" r="7" fill="#c084fc" />
            <circle cx="83" cy="28" r="3.5" fill="#c084fc" />
            <circle cx="91" cy="29" r="3.5" fill="#c084fc" />
            <circle cx="95" cy="35" r="3" fill="#c084fc" />
          </g>
        )}

        {/* TAIL */}
        <path
          d="M 75 88 Q 90 95 85 105"
          stroke="#9d6fe8"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="84" cy="106" r="5" fill="#c084fc" />

        {/* sparkles around when waving */}
        {phase === "waving" && (
          <>
            <text x="78" y="18" fontSize="12" style={{ animation: "fadeIn 0.3s ease" }}>✨</text>
            <text x="20" y="30" fontSize="10" style={{ animation: "fadeIn 0.5s ease" }}>⭐</text>
          </>
        )}
      </svg>

      <style>{`
        @keyframes waveArm {
          from { transform: rotate(-15deg); }
          to   { transform: rotate(15deg); }
        }
      `}</style>
    </div>
  );
}
