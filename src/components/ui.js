import { useState } from "react";
import { DRIVER_IMAGES, theme } from "../constants";

const { card, border, accent, muted } = theme;

export const Card = ({ children, style, className }) => (
  <div className={className} style={{
    background: card, border: `1px solid ${border}`,
    borderRadius: 10, padding: "1.25rem", ...style,
  }}>
    {children}
  </div>
);

export const SectionLabel = ({ children, style }) => (
  <div style={{
    fontSize: "0.6rem", letterSpacing: "0.22em", textTransform: "uppercase",
    color: accent, marginBottom: "0.85rem", fontFamily: "monospace", ...style,
  }}>
    {children}
  </div>
);

export const DriverAvatar = ({ driverId, name, size = 40 }) => {
  const [imgError, setImgError] = useState(false);
  const imgUrl = DRIVER_IMAGES[driverId];
  const initials = name ? name.split(" ").map(n => n[0]).join("").slice(0, 2) : driverId?.slice(0, 2) || "??";

  if (!imgUrl || imgError) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "#1f1f2e", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: size * 0.35, fontWeight: 700,
        color: muted, flexShrink: 0,
      }}>{initials}</div>
    );
  }

  return (
    <img
      src={imgUrl} alt={name}
      onError={() => setImgError(true)}
      referrerPolicy="no-referrer"
      style={{
        width: size, height: size, borderRadius: "50%",
        objectFit: "cover", objectPosition: "top",
        background: "#1f1f2e", flexShrink: 0,
      }}
    />
  );
};

export const LoadingSpinner = ({ label = "Loading..." }) => (
  <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#444" }}>
    <div style={{ fontSize: "0.78rem", fontFamily: "monospace", letterSpacing: "0.15em" }}>{label}</div>
  </div>
);

export const Badge = ({ children, color = accent, bg }) => (
  <span style={{
    fontSize: "0.62rem", fontWeight: 700, color,
    background: bg ?? `${color}18`,
    border: `1px solid ${color}44`,
    borderRadius: 4, padding: "0.15rem 0.4rem",
    fontFamily: "monospace", letterSpacing: "0.08em",
    display: "inline-block",
  }}>{children}</span>
);

export const ProgressBar = ({ value, max, color, height = 4, style }) => (
  <div style={{ height, background: "#1a1a24", borderRadius: 99, overflow: "hidden", ...style }}>
    <div style={{
      height: "100%",
      width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%`,
      background: color,
      borderRadius: 99,
      transition: "width 0.4s ease",
    }} />
  </div>
);

export const PosColor = (i) => i === 0 ? accent : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : muted;
