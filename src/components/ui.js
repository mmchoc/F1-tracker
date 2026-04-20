import { useState, useEffect, useRef } from "react";
import { motion, animate as fmAnimate } from "framer-motion";
import { DRIVER_IMAGES, theme } from "../constants";

const { accent, muted } = theme;

// ── Driver Avatar with ui-avatars.com fallback ────────────────────────────────
export const DriverAvatar = ({ driverId, name, size = 40 }) => {
  const f1Url = DRIVER_IMAGES[driverId] || null;
  const uiAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || driverId || "?")}&background=12121a&color=ffffff&size=128&bold=true&font-size=0.45&rounded=true`;
  const initials = name
    ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : (driverId?.slice(0, 2) || "??").toUpperCase();

  // stage 0 → try F1 official, stage 1 → try ui-avatars, stage 2 → initials div
  const [stage, setStage] = useState(0);

  const src = stage === 0 && f1Url ? f1Url : stage === 1 ? uiAvatarUrl : null;

  if (stage >= 2 || !src) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "linear-gradient(135deg, #1a1a2e 0%, #12121a 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.33, fontWeight: 700, color: "#888",
        flexShrink: 0, letterSpacing: "-0.02em",
      }}>{initials}</div>
    );
  }

  return (
    <img
      src={src}
      alt={name || driverId}
      onError={() => setStage(s => s + 1)}
      referrerPolicy="no-referrer"
      style={{
        width: size, height: size, borderRadius: "50%",
        objectFit: "cover", objectPosition: "top center",
        background: "#12121a", flexShrink: 0,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    />
  );
};

// ── Glassmorphism card ────────────────────────────────────────────────────────
export const Card = ({ children, style, className, onClick }) => (
  <div className={className} onClick={onClick} style={{
    background: "rgba(12, 12, 20, 0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "1.25rem",
    boxShadow: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
    ...style,
  }}>
    {children}
  </div>
);

export const GlassCard = ({ children, style, accentColor, whileHover }) => (
  <motion.div
    whileHover={whileHover || { scale: 1.005, borderColor: accentColor ? accentColor + "40" : "rgba(255,255,255,0.1)" }}
    transition={{ duration: 0.15 }}
    style={{
      background: "rgba(12, 12, 20, 0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: `1px solid ${accentColor ? accentColor + "25" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 12,
      boxShadow: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
      ...style,
    }}
  >
    {children}
  </motion.div>
);

// ── Section label ─────────────────────────────────────────────────────────────
export const SectionLabel = ({ children, style }) => (
  <div style={{
    fontSize: "0.58rem", letterSpacing: "0.25em", textTransform: "uppercase",
    color: accent, marginBottom: "0.85rem", fontFamily: "monospace",
    display: "flex", alignItems: "center", gap: "0.5rem", ...style,
  }}>
    <span style={{ display: "inline-block", width: 16, height: 1.5, background: accent, opacity: 0.6 }} />
    {children}
  </div>
);

// ── Animated counter ──────────────────────────────────────────────────────────
export const AnimatedCounter = ({ value, style }) => {
  const nodeRef = useRef(null);
  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !isFinite(value)) return;
    const ctrl = fmAnimate(parseFloat(node.textContent) || 0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: v => { if (node) node.textContent = Math.round(v); },
    });
    return () => ctrl.stop();
  }, [value]);
  return <span ref={nodeRef} style={style}>{value}</span>;
};

// ── Skeleton loader ───────────────────────────────────────────────────────────
export const Skeleton = ({ width, height = 16, borderRadius = 6, style }) => (
  <div style={{
    width: width || "100%", height, borderRadius,
    background: "linear-gradient(90deg, #0e0e1a 25%, #16162a 50%, #0e0e1a 75%)",
    backgroundSize: "400px 100%",
    animation: "shimmer 1.5s infinite",
    ...style,
  }} />
);

export const SkeletonRow = ({ lines = 1 }) => (
  <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "rgba(14,14,26,0.6)", marginBottom: 4 }}>
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <Skeleton width={32} height={32} borderRadius="50%" />
      <div style={{ flex: 1 }}>
        <Skeleton width="40%" height={12} style={{ marginBottom: 6 }} />
        {lines > 1 && <Skeleton width="60%" height={10} />}
      </div>
      <Skeleton width={40} height={20} />
    </div>
  </div>
);

// ── Progress bar ──────────────────────────────────────────────────────────────
export const ProgressBar = ({ value, max, color, height = 4, animated = false, style }) => (
  <div style={{ height, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden", ...style }}>
    <motion.div
      initial={animated ? { width: 0 } : false}
      animate={{ width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%` }}
      transition={animated ? { duration: 0.8, ease: "easeOut" } : { duration: 0.4 }}
      style={{ height: "100%", background: color, borderRadius: 99 }}
    />
  </div>
);

// ── Badge ─────────────────────────────────────────────────────────────────────
export const Badge = ({ children, color = accent, style }) => (
  <span style={{
    fontSize: "0.6rem", fontWeight: 700, color,
    background: color + "18", border: `1px solid ${color}44`,
    borderRadius: 4, padding: "0.15rem 0.45rem",
    fontFamily: "monospace", letterSpacing: "0.1em",
    display: "inline-block", ...style,
  }}>{children}</span>
);

// ── Position color helper ─────────────────────────────────────────────────────
export const PosColor = (i) => i === 0 ? accent : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : muted;

// ── Loading spinner with label ────────────────────────────────────────────────
export const LoadingSpinner = ({ label = "Loading..." }) => (
  <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#333" }}>
    <div style={{ fontSize: "0.75rem", fontFamily: "monospace", letterSpacing: "0.15em", color: "#444" }}>{label}</div>
  </div>
);

// ── Framer Motion list variants ───────────────────────────────────────────────
export const listVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.045 } },
};

export const rowVariants = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

export const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15 } },
};
