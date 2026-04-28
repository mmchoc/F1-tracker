import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DriverAvatar } from "./ui";
import { ERGAST, OF1, COUNTRY_FLAGS, theme } from "../constants";

const { accent } = theme;

const TEAM_COLORS = {
  "Mercedes":        "#00D2BE",
  "Ferrari":         "#DC143C",
  "McLaren":         "#FF8000",
  "Red Bull":        "#1E41FF",
  "Haas F1 Team":    "#FFFFFF",
  "Haas":            "#FFFFFF",
  "RB F1 Team":      "#6692FF",
  "Racing Bulls":    "#6692FF",
  "Visa Cash App RB Formula One Team": "#6692FF",
  "Audi":            "#e8091e",
  "Stake F1 Team":   "#00e2a0",
  "Alpine F1 Team":  "#0090FF",
  "Alpine":          "#0090FF",
  "Williams":        "#64C4FF",
  "Aston Martin":    "#006F62",
};

const TYRE_COLORS = {
  SOFT:         "#e10600",
  MEDIUM:       "#f5c518",
  HARD:         "#d8d8d8",
  INTERMEDIATE: "#00c878",
  WET:          "#4488ff",
};
const TYRE_LABELS = { SOFT:"S", MEDIUM:"M", HARD:"H", INTERMEDIATE:"I", WET:"W" };

function teamColor(name) { return TEAM_COLORS[name] || "#888"; }
function isClassified(status) { return status === "Finished" || /^\+\d+ Lap/.test(status); }

// ── TyreDot ───────────────────────────────────────────────────────────────────
function TyreDot({ compound, laps }) {
  const key   = (compound || "").toUpperCase();
  const color = TYRE_COLORS[key] || "#555";
  const label = TYRE_LABELS[key] || "?";
  return (
    <div
      title={`${compound || "?"} — ${laps || "?"} laps`}
      style={{
        width: 17, height: 17, borderRadius: "50%",
        background: color, color: key === "HARD" ? "#222" : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.52rem", fontWeight: 800, flexShrink: 0,
        boxShadow: `0 0 5px ${color}55`,
      }}
    >{label}</div>
  );
}

// ── TyreStrategy ──────────────────────────────────────────────────────────────
function TyreStrategy({ stints }) {
  if (!stints || !stints.length)
    return <span style={{ color: "#333", fontSize: "0.7rem" }}>—</span>;
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {stints.map((s, i) => (
        <TyreDot key={i} compound={s.compound} laps={(s.lap_end || 0) - (s.lap_start || 0) + 1} />
      ))}
    </div>
  );
}

// ── PositionDelta ─────────────────────────────────────────────────────────────
function PositionDelta({ grid, position }) {
  const g = parseInt(grid), p = parseInt(position);
  if (!grid || grid === "0")
    return <span style={{ color: "#444", fontFamily: "monospace", fontSize: "0.72rem" }}>PL</span>;
  const delta = g - p;
  if (delta === 0)
    return <span style={{ color: "#444", fontFamily: "monospace" }}>—</span>;
  const color = delta > 0 ? "#00e088" : "#ff5555";
  const arrow = delta > 0 ? "▲" : "▼";
  return (
    <motion.span
      initial={{ opacity: 0, y: delta > 0 ? 5 : -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.04 * Math.abs(delta) }}
      style={{
        color, fontFamily: "monospace", fontWeight: 700,
        fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 1,
      }}
    >
      <span style={{ fontSize: "0.5rem" }}>{arrow}</span>
      {Math.abs(delta)}
    </motion.span>
  );
}

// ── PosBadge ──────────────────────────────────────────────────────────────────
function PosBadge({ pos }) {
  const n  = parseInt(pos);
  const bg = n === 1 ? "#ffd700" : n === 2 ? "#c0c0c0" : n === 3 ? "#cd7f32" : "rgba(255,255,255,0.05)";
  const fg = n <= 3 ? "#000" : "#777";
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 6,
      background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "0.78rem", fontWeight: 800, flexShrink: 0,
    }}>{pos}</div>
  );
}

// ── StatItem ──────────────────────────────────────────────────────────────────
function StatItem({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: "0.54rem", color: "#555", fontFamily: "monospace", letterSpacing: "0.14em", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: color || "#f0ece3", whiteSpace: "nowrap" }}>
        {value}
      </div>
    </div>
  );
}

// ── TH ────────────────────────────────────────────────────────────────────────
function TH({ children, align = "center" }) {
  return (
    <th style={{
      padding: "0.7rem 0.75rem",
      textAlign: align,
      fontSize: "0.56rem", letterSpacing: "0.16em",
      color: "#444", fontWeight: 600, fontFamily: "monospace",
      whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>{children}</th>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LiveTimingTab() {
  const [completedRaces, setCompletedRaces] = useState([]);
  const [selectedRound, setSelectedRound]   = useState(null);
  const [raceData,      setRaceData]         = useState(null);
  const [stintsMap,     setStintsMap]        = useState({});
  const [weatherData,   setWeatherData]      = useState(null);
  const [loading,       setLoading]          = useState(false);
  const [schedLoading,  setSchedLoading]     = useState(true);

  // Fetch schedule & auto-detect completed races
  useEffect(() => {
    const today = new Date();
    fetch(`${ERGAST}/2026.json`)
      .then(r => r.json())
      .then(data => {
        const races = data.MRData?.RaceTable?.Races || [];
        const done  = races.filter(r => {
          const d = new Date(r.date);
          d.setDate(d.getDate() + 1);
          return d <= today;
        });
        setCompletedRaces(done);
        if (done.length) setSelectedRound(done[done.length - 1].round);
        setSchedLoading(false);
      })
      .catch(() => setSchedLoading(false));
  }, []);

  // Fetch results + OpenF1 enrichment on round change
  useEffect(() => {
    if (!selectedRound) return;
    setLoading(true);
    setRaceData(null);
    setStintsMap({});
    setWeatherData(null);

    const go = async () => {
      try {
        const res  = await fetch(`${ERGAST}/2026/${selectedRound}/results.json`);
        const json = await res.json();
        const race = json.MRData?.RaceTable?.Races?.[0];
        if (!race) { setLoading(false); return; }
        setRaceData(race);

        // OpenF1 best-effort enrichment
        try {
          const sessRes  = await fetch(`${OF1}/sessions?year=2026&session_name=Race`);
          const sessions = await sessRes.json();
          const session  = sessions.find(s => s.date_start?.startsWith(race.date));
          if (session) {
            const sk = session.session_key;
            const [stintsArr, wxArr] = await Promise.all([
              fetch(`${OF1}/stints?session_key=${sk}`).then(r => r.json()).catch(() => []),
              fetch(`${OF1}/weather?session_key=${sk}`).then(r => r.json()).catch(() => []),
            ]);
            const sMap = {};
            for (const s of stintsArr) {
              const k = String(s.driver_number);
              (sMap[k] = sMap[k] || []).push(s);
            }
            for (const k of Object.keys(sMap))
              sMap[k].sort((a, b) => (a.lap_start || 0) - (b.lap_start || 0));
            setStintsMap(sMap);
            if (wxArr.length) setWeatherData(wxArr[Math.floor(wxArr.length * 0.6)]);
          }
        } catch { /* OpenF1 optional */ }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    go();
  }, [selectedRound]);

  const fastestLapHolder = useMemo(() => {
    if (!raceData?.Results) return null;
    return raceData.Results.find(r => r.FastestLap?.rank === "1") || null;
  }, [raceData]);

  const driverOfTheDay = useMemo(() => {
    if (!raceData?.Results) return null;
    let best = null, bestGain = 0;
    for (const r of raceData.Results) {
      const g = parseInt(r.grid), p = parseInt(r.position);
      if (g > 0 && !isNaN(g) && !isNaN(p)) {
        const gain = g - p;
        if (gain > bestGain) { bestGain = gain; best = { ...r, gain }; }
      }
    }
    if (!best && fastestLapHolder) best = { ...fastestLapHolder, gain: 0, isFastestOnly: true };
    return best;
  }, [raceData, fastestLapHolder]);

  if (schedLoading) return (
    <div style={{ textAlign: "center", padding: "5rem 1rem", color: "#444" }}>
      <div style={{ fontFamily: "monospace", fontSize: "0.72rem", letterSpacing: "0.18em" }}>
        LOADING 2026 SEASON…
      </div>
    </div>
  );

  if (!completedRaces.length) return (
    <div style={{ textAlign: "center", padding: "5rem 1rem", color: "#444" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🏁</div>
      <div style={{ fontFamily: "monospace", fontSize: "0.72rem", letterSpacing: "0.18em" }}>
        SEASON HASN'T STARTED YET
      </div>
    </div>
  );

  const race       = raceData;
  const flag       = race ? (COUNTRY_FLAGS[race.Circuit?.Location?.country] || "🏁") : "";
  const poleDriver = race?.Results?.find(r => r.grid === "1");

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>

      {/* ── Race selector ──────────────────────────────────────────────────── */}
      <div style={{ overflowX: "auto", marginBottom: "1.5rem", paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: "0.5rem", minWidth: "max-content" }}>
          {completedRaces.map(r => {
            const rFlag  = COUNTRY_FLAGS[r.Circuit?.Location?.country] || "🏁";
            const active = r.round === selectedRound;
            return (
              <motion.button
                key={r.round}
                onClick={() => setSelectedRound(r.round)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  padding: "0.45rem 0.9rem",
                  background: active ? `${accent}18` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? accent : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 8, cursor: "pointer", minWidth: 52,
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <span style={{ fontSize: "1.05rem", lineHeight: 1 }}>{rFlag}</span>
                <span style={{
                  fontFamily: "monospace", fontSize: "0.58rem", letterSpacing: "0.06em",
                  color: active ? accent : "#555", fontWeight: active ? 700 : 400,
                }}>R{r.round}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Loading indicator ──────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#444" }}>
          <div style={{ fontFamily: "monospace", fontSize: "0.72rem", letterSpacing: "0.18em" }}>
            LOADING RACE DATA…
          </div>
        </div>
      )}

      {/* ── Race content ───────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {race && !loading && (
          <motion.div
            key={String(selectedRound)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >

            {/* ── Summary header ───────────────────────────────────────────── */}
            <div style={{
              background: "rgba(10,10,20,0.85)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "1.25rem 1.5rem",
              marginBottom: "1.25rem",
              boxShadow: "0 4px 32px rgba(0,0,0,0.35)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1.25rem" }}>
                <div>
                  <div style={{ fontSize: "0.55rem", color: accent, fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: 6 }}>
                    ROUND {race.round} · {race.season} FIA FORMULA ONE WORLD CHAMPIONSHIP
                  </div>
                  <h2 style={{ margin: "0 0 4px", fontSize: "clamp(1.15rem, 2.8vw, 1.55rem)", fontWeight: 800, letterSpacing: "-0.03em" }}>
                    {flag} {race.raceName}
                  </h2>
                  <div style={{ color: "#555", fontSize: "0.76rem" }}>{race.Circuit.circuitName}</div>
                </div>
                <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap" }}>
                  <StatItem
                    label="DATE"
                    value={new Date(race.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  />
                  <StatItem label="LAPS" value={race.Results[0]?.laps || "—"} />
                  <StatItem label="POLE POSITION" value={poleDriver?.Driver.code || "—"} color={accent} />
                  {fastestLapHolder && (
                    <StatItem
                      label="FASTEST LAP"
                      value={`${fastestLapHolder.Driver.code}  ${fastestLapHolder.FastestLap?.Time?.time || ""}`}
                      color="#cc88ff"
                    />
                  )}
                  {weatherData && (
                    <StatItem
                      label="CONDITIONS"
                      value={`${Math.round(weatherData.track_temperature ?? 0)}°C · ${weatherData.rainfall > 0 ? "🌧 Wet" : "☀ Dry"}`}
                    />
                  )}
                  {weatherData && (
                    <StatItem label="AIR" value={`${Math.round(weatherData.air_temperature ?? 0)}°C`} />
                  )}
                </div>
              </div>
            </div>

            {/* ── Driver of the Day ────────────────────────────────────────── */}
            {driverOfTheDay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.08 }}
                style={{
                  marginBottom: "1.25rem",
                  background: "linear-gradient(120deg, rgba(225,6,0,0.07) 0%, rgba(10,10,20,0.85) 55%)",
                  border: `1px solid ${accent}2a`,
                  borderRadius: 12, padding: "1rem 1.5rem",
                  display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
                  boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", flex: 1, minWidth: 200 }}>
                  <div>
                    <div style={{ fontSize: "0.52rem", color: accent, fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: 6 }}>
                      {driverOfTheDay.isFastestOnly ? "⚡ FASTEST LAP HOLDER" : "⭐ DRIVER OF THE DAY"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <DriverAvatar
                        driverId={driverOfTheDay.Driver.code}
                        name={`${driverOfTheDay.Driver.givenName} ${driverOfTheDay.Driver.familyName}`}
                        size={44}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                          {driverOfTheDay.Driver.givenName} {driverOfTheDay.Driver.familyName}
                        </div>
                        <div style={{ color: teamColor(driverOfTheDay.Constructor.name), fontSize: "0.72rem", fontWeight: 500 }}>
                          {driverOfTheDay.Constructor.name}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                  {driverOfTheDay.gain > 0 && (
                    <StatItem label="POSITIONS GAINED" value={`+${driverOfTheDay.gain}`} color="#00e088" />
                  )}
                  {driverOfTheDay.FastestLap?.Time?.time && (
                    <StatItem label="FASTEST LAP" value={driverOfTheDay.FastestLap.Time.time} color="#cc88ff" />
                  )}
                  <StatItem label="FINISH" value={`P${driverOfTheDay.position}`} />
                  {parseInt(driverOfTheDay.points) > 0 && (
                    <StatItem label="POINTS" value={`+${driverOfTheDay.points}`} color={accent} />
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Results table ────────────────────────────────────────────── */}
            <div style={{
              background: "rgba(10,10,20,0.85)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, overflow: "hidden",
              boxShadow: "0 4px 32px rgba(0,0,0,0.35)",
            }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      <TH align="center">POS</TH>
                      <TH align="left">DRIVER</TH>
                      <TH align="left">TEAM</TH>
                      <TH align="center">GRID</TH>
                      <TH align="center">Δ</TH>
                      <TH align="center">FASTEST LAP</TH>
                      <TH align="center">TIME / GAP</TH>
                      <TH align="center">PTS</TH>
                      <TH align="left">STATUS</TH>
                      <TH align="left">TYRES</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {race.Results.map((result, idx) => {
                      const tc         = teamColor(result.Constructor.name);
                      const isFl       = result.FastestLap?.rank === "1";
                      const stints     = stintsMap[result.number] || [];
                      const classified = isClassified(result.status);
                      const pts        = parseInt(result.points) || 0;
                      return (
                        <motion.tr
                          key={result.number}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.025, duration: 0.2 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.022)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background 0.12s" }}
                        >
                          {/* Pos */}
                          <td style={{ padding: "0.7rem 0.9rem 0.7rem 1rem", width: 46 }}>
                            <PosBadge pos={result.position} />
                          </td>

                          {/* Driver */}
                          <td style={{ padding: "0.7rem 0.9rem", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                              <div style={{ width: 3, height: 30, borderRadius: 2, background: tc, flexShrink: 0 }} />
                              <DriverAvatar
                                driverId={result.Driver.code}
                                name={`${result.Driver.givenName} ${result.Driver.familyName}`}
                                size={30}
                              />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "0.83rem" }}>
                                  {result.Driver.givenName} {result.Driver.familyName}
                                </div>
                                <div style={{ fontSize: "0.64rem", color: "#555", fontFamily: "monospace" }}>
                                  {result.Driver.code}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Team */}
                          <td style={{ padding: "0.7rem 0.9rem", whiteSpace: "nowrap", color: tc, fontSize: "0.76rem", fontWeight: 500 }}>
                            {result.Constructor.name}
                          </td>

                          {/* Grid */}
                          <td style={{ padding: "0.7rem 0.9rem", textAlign: "center", color: "#555", fontFamily: "monospace", fontSize: "0.76rem" }}>
                            {result.grid === "0" ? <span style={{ color: "#444" }}>PL</span> : result.grid}
                          </td>

                          {/* Δ */}
                          <td style={{ padding: "0.7rem 0.9rem", textAlign: "center", minWidth: 38 }}>
                            <PositionDelta grid={result.grid} position={result.position} />
                          </td>

                          {/* Fastest lap */}
                          <td style={{ padding: "0.7rem 0.9rem", textAlign: "center", whiteSpace: "nowrap" }}>
                            {result.FastestLap?.Time?.time ? (
                              <span style={{
                                color: isFl ? "#cc88ff" : "#555",
                                fontFamily: "monospace", fontSize: "0.76rem",
                                background: isFl ? "rgba(204,136,255,0.13)" : "transparent",
                                padding: isFl ? "0.18rem 0.45rem" : "0",
                                borderRadius: 4,
                              }}>
                                {result.FastestLap.Time.time}
                              </span>
                            ) : (
                              <span style={{ color: "#252535" }}>—</span>
                            )}
                          </td>

                          {/* Time / Gap */}
                          <td style={{ padding: "0.7rem 0.9rem", textAlign: "center", fontFamily: "monospace", fontSize: "0.76rem", whiteSpace: "nowrap" }}>
                            {idx === 0
                              ? <span style={{ color: "#f0ece3" }}>{result.Time?.time || "—"}</span>
                              : result.Time?.time
                                ? <span style={{ color: "#888" }}>{result.Time.time}</span>
                                : <span style={{ color: "#333" }}>—</span>
                            }
                          </td>

                          {/* Points */}
                          <td style={{ padding: "0.7rem 0.9rem", textAlign: "center" }}>
                            <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.8rem", color: pts > 0 ? accent : "#333" }}>
                              {pts > 0 ? pts : "—"}
                            </span>
                          </td>

                          {/* Status */}
                          <td style={{ padding: "0.7rem 0.9rem", whiteSpace: "nowrap" }}>
                            <span style={{
                              fontSize: "0.68rem", fontFamily: "monospace",
                              color:      classified ? "#00e088" : "#ff5555",
                              background: classified ? "rgba(0,224,136,0.08)" : "rgba(255,85,85,0.08)",
                              padding: "0.15rem 0.42rem", borderRadius: 4,
                            }}>
                              {result.status}
                            </span>
                          </td>

                          {/* Tyres */}
                          <td style={{ padding: "0.7rem 1rem 0.7rem 0.9rem" }}>
                            <TyreStrategy stints={stints} />
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer legend */}
              <div style={{
                padding: "0.65rem 1rem",
                borderTop: "1px solid rgba(255,255,255,0.04)",
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem",
              }}>
                <div style={{ fontSize: "0.58rem", color: "#2a2a3a", fontFamily: "monospace" }}>
                  JOLPICA ERGAST API · OPENF1
                </div>
                <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
                  {Object.entries(TYRE_COLORS).map(([name, color]) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}66` }} />
                      <span style={{ fontSize: "0.56rem", color: "#3a3a4a", fontFamily: "monospace" }}>
                        {name.charAt(0) + name.slice(1).toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
