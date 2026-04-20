import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, SectionLabel, DriverAvatar, ProgressBar, PosColor, Badge } from "./ui";
import { theme, COMPLETED_ROUNDS } from "../constants";

const { accent, muted, border } = theme;

// Sparkline for recent form
function FormSparkline({ history, color }) {
  const max = Math.max(...history, 1);
  const w = 52, h = 20;
  if (history.length < 2) return null;
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      {history.map((v, i) => {
        const x = (i / (history.length - 1)) * w;
        const y = h - (v / max) * h;
        return <circle key={i} cx={x} cy={y} r={2} fill={color} opacity={0.6} />;
      })}
    </svg>
  );
}

export default function StandingsTab({ drivers, constructors }) {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const leader = drivers[0];
  const p2 = drivers[1];
  const gap = leader && p2 ? leader.pts - p2.pts : 0;

  return (
    <div className="fade-in">
      {/* ── Hero ── */}
      {leader && (
        <div style={{
          background: `linear-gradient(135deg, #12121a 0%, ${leader.color}18 100%)`,
          border: `1px solid ${leader.color}33`,
          borderRadius: 12, padding: "1.5rem 2rem", marginBottom: "2rem",
          display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap",
        }}>
          <DriverAvatar driverId={leader.id} name={leader.name} size={72} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: "0.6rem", letterSpacing: "0.22em", color: accent, fontFamily: "monospace", marginBottom: "0.3rem" }}>
              CHAMPIONSHIP LEADER — AFTER ROUND {COMPLETED_ROUNDS}
            </div>
            <div style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 700, letterSpacing: "-0.02em" }}>
              {leader.name}
            </div>
            <div style={{ fontSize: "0.82rem", color: muted, marginTop: "0.2rem" }}>{leader.team}</div>
          </div>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: leader.color, lineHeight: 1 }}>
                {leader.pts}
              </div>
              <div style={{ fontSize: "0.62rem", color: muted, letterSpacing: "0.15em", fontFamily: "monospace" }}>POINTS</div>
            </div>
            {p2 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", fontWeight: 800, color: accent, lineHeight: 1 }}>
                  +{gap}
                </div>
                <div style={{ fontSize: "0.62rem", color: muted, letterSpacing: "0.15em", fontFamily: "monospace" }}>AHEAD OF P2</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Driver Standings ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "2rem", alignItems: "start" }}>
        <div>
          <SectionLabel>Drivers' Championship</SectionLabel>
          {drivers.map((d, i) => (
            <div key={d.id} className="driver-row"
              onClick={() => setSelectedDriver(selectedDriver?.id === d.id ? null : d)}
              style={{
                background: selectedDriver?.id === d.id ? `${d.color}12` : "#12121a",
                border: `1px solid ${selectedDriver?.id === d.id ? d.color + "50" : border}`,
                borderLeft: `3px solid ${d.color}`,
                borderRadius: 8, padding: "0.8rem 1rem", marginBottom: "0.4rem",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: "1rem",
              }}>
              <span style={{
                color: PosColor(i), fontFamily: "monospace",
                fontSize: "0.82rem", width: 24, flexShrink: 0, fontWeight: 700,
              }}>
                {i + 1}
              </span>
              <DriverAvatar driverId={d.id} name={d.name} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{d.nationality} {d.name}</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: muted }}>{d.team}</div>
              </div>
              <FormSparkline history={d.raceHistory || [d.pts]} color={d.color} />
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 700, color: d.color, fontSize: "1.1rem" }}>{d.pts}</div>
                <div style={{ fontSize: "0.6rem", color: muted, fontFamily: "monospace" }}>PTS</div>
              </div>
              <div style={{ width: 64, flexShrink: 0 }}>
                <ProgressBar value={d.pts} max={drivers[0]?.pts || 1} color={d.color} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Constructors ── */}
        <div>
          <SectionLabel>Constructors' Championship</SectionLabel>
          {constructors.map((c, i) => (
            <div key={c.id} style={{
              background: "#12121a", border: `1px solid ${border}`,
              borderLeft: `3px solid ${c.color}`,
              borderRadius: 8, padding: "0.8rem 1rem", marginBottom: "0.4rem",
              display: "flex", alignItems: "center", gap: "1rem",
            }}>
              <span style={{ color: PosColor(i), fontFamily: "monospace", fontSize: "0.82rem", width: 24, flexShrink: 0, fontWeight: 700 }}>
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{c.name}</div>
                <ProgressBar value={c.pts} max={constructors[0]?.pts || 1} color={c.color} height={3} style={{ marginTop: "0.4rem" }} />
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ fontWeight: 700, color: c.color, fontSize: "1.05rem" }}>{c.pts}</span>
                <span style={{ fontSize: "0.68rem", color: muted }}> pts</span>
              </div>
            </div>
          ))}

          <Card style={{ marginTop: "1.25rem", padding: "1rem" }}>
            <SectionLabel style={{ marginBottom: "0.6rem" }}>Points Chart</SectionLabel>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={constructors.slice(0, 8)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 9 }} />
                <YAxis tick={{ fill: "#555", fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: "#12121a", border: `1px solid ${border}`, fontSize: "0.78rem", borderRadius: 6 }}
                  labelStyle={{ color: "#aaa" }}
                  cursor={{ fill: "#ffffff08" }}
                />
                <Bar dataKey="pts" radius={[3,3,0,0]}>
                  {constructors.slice(0, 8).map(c => <Cell key={c.id} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* ── Driver detail panel ── */}
      {selectedDriver && (
        <Card style={{ marginTop: "1.5rem", borderColor: selectedDriver.color + "44" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.25rem" }}>
            <DriverAvatar driverId={selectedDriver.id} name={selectedDriver.name} size={64} />
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.2rem" }}>{selectedDriver.name}</div>
              <div style={{ fontSize: "0.8rem", color: muted }}>{selectedDriver.team}</div>
              <Badge color={selectedDriver.color} style={{ marginTop: "0.3rem" }}>{selectedDriver.id}</Badge>
            </div>
          </div>
          <SectionLabel>Driver Ratings</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <div>
              {Object.entries(selectedDriver.ratings).map(([k, v]) => (
                <div key={k} style={{ marginBottom: "0.65rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.3rem" }}>
                    <span style={{ color: muted, textTransform: "capitalize" }}>{k}</span>
                    <span style={{ color: selectedDriver.color, fontFamily: "monospace", fontWeight: 600 }}>{v}</span>
                  </div>
                  <ProgressBar value={v} max={100} color={selectedDriver.color} height={5} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[
                ["Current Points", `${selectedDriver.pts}`],
                ["Points/Race", (selectedDriver.pts / COMPLETED_ROUNDS).toFixed(1)],
                ["Overall Rating", (Object.values(selectedDriver.ratings).reduce((a,b)=>a+b,0)/5).toFixed(0)],
              ].map(([label, val]) => (
                <div key={label} style={{ background: "#0f0f18", borderRadius: 8, padding: "0.85rem 1rem" }}>
                  <div style={{ fontSize: "0.63rem", color: muted, letterSpacing: "0.1em", fontFamily: "monospace", marginBottom: "0.3rem" }}>{label}</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: selectedDriver.color }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
