import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { GlassCard, SectionLabel, DriverAvatar, ProgressBar, PosColor, Badge, AnimatedCounter, Skeleton, SkeletonRow, listVariants, rowVariants } from "./ui";
import { theme, COMPLETED_ROUNDS } from "../constants";

const { accent } = theme;

function FormSparkline({ history, color }) {
  if (!history || history.length < 2) return null;
  const max = Math.max(...history, 1);
  const W = 48, H = 18;
  const pts = history.map((v, i) => `${(i / (history.length - 1)) * W},${H - (v / max) * H}`).join(" ");
  return (
    <svg width={W} height={H} style={{ display: "block", flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
      {history.map((v, i) => (
        <circle key={i} cx={(i / (history.length - 1)) * W} cy={H - (v / max) * H} r={2.2} fill={color} opacity={0.65} />
      ))}
    </svg>
  );
}

export default function StandingsTab({ drivers, constructors }) {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const leader = drivers[0];
  const p2     = drivers[1];
  const gap    = leader && p2 ? leader.pts - p2.pts : 0;

  const loading = !drivers.length;

  return (
    <div>
      {/* ── Hero ── */}
      {loading ? (
        <div style={{ background: "rgba(12,12,20,0.85)", borderRadius: 16, padding: "1.5rem 2rem", marginBottom: "2rem" }}>
          <Skeleton width="30%" height={12} style={{ marginBottom: 12 }} />
          <Skeleton width="50%" height={28} style={{ marginBottom: 8 }} />
          <Skeleton width="25%" height={12} />
        </div>
      ) : leader && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            background: `linear-gradient(135deg, rgba(12,12,22,0.95) 0%, ${leader.color}14 100%)`,
            border: `1px solid ${leader.color}28`,
            borderRadius: 16, padding: "1.75rem 2rem", marginBottom: "2rem",
            backdropFilter: "blur(20px)",
            boxShadow: `0 8px 40px rgba(0,0,0,0.4), 0 0 80px ${leader.color}06`,
            display: "flex", alignItems: "center", gap: "1.75rem", flexWrap: "wrap",
          }}>
          <DriverAvatar driverId={leader.id} name={leader.name} size={80} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: "0.58rem", letterSpacing: "0.24em", color: accent, fontFamily: "monospace", marginBottom: "0.35rem" }}>
              CHAMPIONSHIP LEADER — ROUND {COMPLETED_ROUNDS}
            </div>
            <div style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {leader.name}
            </div>
            <div style={{ fontSize: "0.82rem", color: "#666", marginTop: "0.25rem" }}>{leader.team}</div>
          </div>
          <div style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.8rem", fontWeight: 900, color: leader.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                <AnimatedCounter value={leader.pts} />
              </div>
              <div style={{ fontSize: "0.58rem", color: "#444", letterSpacing: "0.2em", fontFamily: "monospace", marginTop: "0.2rem" }}>POINTS</div>
            </div>
            {p2 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2.8rem", fontWeight: 900, color: accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  +{gap}
                </div>
                <div style={{ fontSize: "0.58rem", color: "#444", letterSpacing: "0.2em", fontFamily: "monospace", marginTop: "0.2rem" }}>AHEAD OF P2</div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "2rem", alignItems: "start" }}>

        {/* ── Driver standings ── */}
        <div>
          <SectionLabel>Drivers' Championship</SectionLabel>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} lines={2} />)
          ) : (
            <motion.div variants={listVariants} initial="hidden" animate="show">
              {drivers.map((d, i) => (
                <motion.div
                  key={d.id}
                  variants={rowVariants}
                  whileHover={{ x: 3, borderColor: d.color + "55" }}
                  onClick={() => setSelectedDriver(selectedDriver?.id === d.id ? null : d)}
                  style={{
                    background: selectedDriver?.id === d.id ? `${d.color}10` : "rgba(12,12,20,0.85)",
                    backdropFilter: "blur(16px)",
                    border: `1px solid ${selectedDriver?.id === d.id ? d.color + "44" : "rgba(255,255,255,0.055)"}`,
                    borderLeft: `3px solid ${d.color}`,
                    borderRadius: 10, padding: "0.85rem 1.1rem", marginBottom: "0.4rem",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "1rem",
                    boxShadow: selectedDriver?.id === d.id ? `0 0 20px ${d.color}12` : "none",
                  }}>
                  <span style={{ color: PosColor(i), fontFamily: "monospace", fontSize: "0.82rem", width: 22, flexShrink: 0, fontWeight: 700 }}>
                    {i + 1}
                  </span>
                  <DriverAvatar driverId={d.id} name={d.name} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>{d.nationality} {d.name}</span>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#555", marginTop: "0.1rem" }}>{d.team}</div>
                  </div>
                  <FormSparkline history={d.raceHistory || [d.pts]} color={d.color} />
                  <div style={{ textAlign: "right", flexShrink: 0, minWidth: 48 }}>
                    <div style={{ fontWeight: 800, color: d.color, fontSize: "1.15rem", fontVariantNumeric: "tabular-nums" }}>{d.pts}</div>
                    <div style={{ fontSize: "0.56rem", color: "#333", fontFamily: "monospace", letterSpacing: "0.12em" }}>PTS</div>
                  </div>
                  <div style={{ width: 60, flexShrink: 0 }}>
                    <ProgressBar value={d.pts} max={drivers[0]?.pts || 1} color={d.color} animated />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Driver detail panel */}
          <AnimatePresence>
            {selectedDriver && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: "hidden", marginTop: "0.75rem" }}>
                <GlassCard accentColor={selectedDriver.color} style={{ padding: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.25rem" }}>
                    <DriverAvatar driverId={selectedDriver.id} name={selectedDriver.name} size={68} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.02em" }}>{selectedDriver.name}</div>
                      <div style={{ fontSize: "0.78rem", color: "#555", marginTop: "0.15rem" }}>{selectedDriver.team}</div>
                      <Badge color={selectedDriver.color} style={{ marginTop: "0.4rem" }}>{selectedDriver.id}</Badge>
                    </div>
                  </div>
                  <SectionLabel>Driver Ratings</SectionLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                    <div>
                      {Object.entries(selectedDriver.ratings).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: "0.7rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.3rem" }}>
                            <span style={{ color: "#555", textTransform: "capitalize" }}>{k}</span>
                            <span style={{ color: selectedDriver.color, fontFamily: "monospace", fontWeight: 700 }}>{v}</span>
                          </div>
                          <ProgressBar value={v} max={100} color={selectedDriver.color} height={5} animated />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {[
                        ["Current Points", selectedDriver.pts],
                        ["Points / Race", +(selectedDriver.pts / COMPLETED_ROUNDS).toFixed(1)],
                        ["Overall Rating", Math.round(Object.values(selectedDriver.ratings).reduce((a,b)=>a+b,0)/5)],
                      ].map(([lbl, val]) => (
                        <div key={lbl} style={{
                          background: "rgba(8,8,16,0.8)", borderRadius: 10, padding: "0.9rem 1rem",
                          border: "1px solid rgba(255,255,255,0.04)",
                        }}>
                          <div style={{ fontSize: "0.6rem", color: "#444", letterSpacing: "0.12em", fontFamily: "monospace", marginBottom: "0.3rem" }}>{lbl}</div>
                          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: selectedDriver.color, fontVariantNumeric: "tabular-nums" }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Constructors ── */}
        <div>
          <SectionLabel>Constructors' Championship</SectionLabel>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : (
            <motion.div variants={listVariants} initial="hidden" animate="show">
              {constructors.map((c, i) => (
                <motion.div
                  key={c.id}
                  variants={rowVariants}
                  whileHover={{ x: 2 }}
                  style={{
                    background: "rgba(12,12,20,0.85)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.055)",
                    borderLeft: `3px solid ${c.color}`,
                    borderRadius: 10, padding: "0.8rem 1rem", marginBottom: "0.4rem",
                    display: "flex", alignItems: "center", gap: "1rem",
                  }}>
                  <span style={{ color: PosColor(i), fontFamily: "monospace", fontSize: "0.78rem", width: 22, flexShrink: 0, fontWeight: 700 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{c.name}</div>
                    <ProgressBar value={c.pts} max={constructors[0]?.pts || 1} color={c.color} height={3} animated style={{ marginTop: "0.4rem" }} />
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ fontWeight: 800, color: c.color, fontSize: "1.05rem", fontVariantNumeric: "tabular-nums" }}>{c.pts}</span>
                    <span style={{ fontSize: "0.65rem", color: "#444" }}> pts</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          <GlassCard style={{ marginTop: "1.25rem", padding: "1.1rem" }}>
            <SectionLabel style={{ marginBottom: "0.5rem" }}>Points Comparison</SectionLabel>
            {loading ? <Skeleton height={180} /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={constructors.slice(0, 8)} margin={{ top: 4, right: 0, bottom: 0, left: -22 }}>
                  <XAxis dataKey="name" tick={{ fill: "#444", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#444", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(255,255,255,0.06)", fontSize: "0.78rem", borderRadius: 8, backdropFilter: "blur(16px)" }}
                    labelStyle={{ color: "#888" }}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="pts" radius={[4,4,0,0]}>
                    {constructors.slice(0, 8).map(c => <Cell key={c.id} fill={c.color} opacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
