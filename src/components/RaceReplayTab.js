import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionLabel, pageVariants } from "./ui";
import { ERGAST, OF1, COUNTRY_FLAGS, COMP_COLOR, theme, formatLap } from "../constants";

const { accent } = theme;

// ── SVG circuit paths ─────────────────────────────────────────────────────────
// viewBox 0 0 500 300 · keyed by Ergast locality name
// Paths are drawn so that progress 0→1 follows the racing direction
const CIRCUIT_PATHS = {
  // Australia — Albert Park: anti-clockwise flowing park circuit
  "Melbourne": "M 450 190 L 450 85 C 450 58 430 40 402 40 L 285 40 C 262 40 246 55 238 76 L 220 116 C 212 136 196 148 174 148 L 118 148 C 92 148 72 166 72 192 L 72 228 C 72 256 92 272 120 272 L 388 272 C 418 272 440 254 448 226 L 450 190",

  // China — Shanghai: hairpin T1 top-right, snail T6 left, long back straight
  "Shanghai": "M 462 155 L 462 88 C 462 54 434 34 402 34 C 355 34 334 72 334 108 L 334 148 C 334 172 316 188 292 188 L 186 188 C 157 188 136 170 136 146 L 136 112 C 136 80 116 58 86 58 C 52 58 38 90 38 124 C 38 160 58 180 88 180 C 118 180 138 198 138 228 L 138 252 C 138 265 150 274 162 274 L 370 274 C 410 274 442 252 454 220 L 462 188 L 462 155",

  // Japan — Suzuka: figure-8, two loops meeting at the crossover bridge
  "Suzuka": "M 258 148 C 260 120 274 84 310 64 C 352 42 408 58 428 94 C 448 130 434 176 404 196 C 374 214 334 210 306 186 C 280 164 262 152 258 148 C 254 144 240 132 214 118 C 182 102 144 108 124 134 C 104 160 110 200 136 218 C 160 234 198 232 224 212 C 250 192 256 164 258 148",

  // Bahrain — Sakhir: three-sector desert circuit
  "Sakhir": "M 442 252 L 470 186 L 470 106 C 470 70 446 48 414 48 L 350 48 C 320 48 298 70 292 98 L 278 150 C 272 172 256 186 234 186 L 170 186 C 140 186 118 204 118 228 L 118 252 C 118 278 138 290 162 290 L 400 290 C 424 290 440 274 442 252",

  // Saudi Arabia — Jeddah: long narrow fast Corniche street circuit
  "Jeddah": "M 462 258 L 462 52 C 462 40 452 32 440 32 L 392 32 C 378 32 370 42 370 54 L 370 184 C 370 198 360 208 346 208 L 156 208 C 142 208 134 198 134 188 L 134 94 C 134 68 116 52 96 52 C 70 52 56 72 56 92 L 56 258 C 56 272 66 280 80 280 L 440 280 C 452 280 462 272 462 258",
};

// ── Fetch with 429 retry ──────────────────────────────────────────────────────
async function fetchWithRetry(url, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, delayMs)); // eslint-disable-line no-loop-func
      delayMs *= 2;
      continue;
    }
    return res.json();
  }
  throw new Error(`Rate limited after ${retries} retries: ${url}`);
}

// ── Load step labels ──────────────────────────────────────────────────────────
const STEPS = [
  "Fetching session...",
  "Loading drivers...",
  "Loading laps...",
  "Loading tyre data...",
  "Processing...",
  "Ready",
];

// ── Place driver dots on SVG path using gap-based spread ─────────────────────
// Leader anchored near position 0; each trailing driver positioned proportionally
// behind by their cumulative time gap vs. the average lap time.
function computeDots(allLaps, selectedLap, totalLaps, driverMap, stints, pathEl) {
  if (!pathEl || !allLaps.length || !totalLaps) return [];
  const totalLen = pathEl.getTotalLength();
  if (!totalLen) return [];

  const byDriver = {};
  for (const l of allLaps) {
    const k = String(l.driver_number);
    if (!byDriver[k]) byDriver[k] = [];
    byDriver[k].push(l);
  }

  const entries = Object.entries(byDriver).map(([num, laps]) => {
    const completed = laps
      .filter(l => l.lap_number != null && l.lap_number <= selectedLap && l.lap_duration != null)
      .sort((a, b) => a.lap_number - b.lap_number);
    const cumTime = completed.reduce((s, l) => s + l.lap_duration, 0);
    return { num, cumTime, lapsCompleted: completed.length };
  }).filter(d => d.lapsCompleted > 0);

  if (!entries.length) return [];

  entries.sort((a, b) => b.lapsCompleted - a.lapsCompleted || a.cumTime - b.cumTime);
  const leader = entries[0];
  const avgLapTime = leader.lapsCompleted > 0 ? leader.cumTime / leader.lapsCompleted : 90;

  return entries.map(d => {
    const gap = d.cumTime - leader.cumTime;
    const lapFrac = gap / avgLapTime;
    const progress = (((-lapFrac) % 1) + 1) % 1;
    const pt = pathEl.getPointAtLength(progress * totalLen);
    const drv = driverMap[d.num] || {};
    const stint = stints[d.num];
    return {
      num: d.num,
      x: pt.x, y: pt.y,
      color: drv.team_colour ? `#${drv.team_colour}` : "#888",
      code: drv.name_acronym || `#${d.num}`,
      lapsCompleted: d.lapsCompleted,
      compound: stint?.compound || "",
    };
  });
}

export default function RaceReplayTab() {
  // ── schedule / session ───────────────────────────────────────────────────
  const [allRaces,    setAllRaces]    = useState([]);
  const [of1Sessions, setOf1Sessions] = useState([]);
  const [selectedRace,setSelectedRace]= useState(null);
  const [initLoading, setInitLoading] = useState(true);

  // ── per-race data load ───────────────────────────────────────────────────
  const [loadStep,    setLoadStep]    = useState(null);
  const [loadPct,     setLoadPct]     = useState(0);
  const [error,       setError]       = useState(null);
  const [dataReady,   setDataReady]   = useState(false);

  // ── race data ────────────────────────────────────────────────────────────
  const [driverMap,   setDriverMap]   = useState({});
  const [stints,      setStints]      = useState({});
  const [allLaps,     setAllLaps]     = useState([]);
  const [ergResults,  setErgResults]  = useState([]);
  const [totalLaps,   setTotalLaps]   = useState(0);

  // ── lap replay ───────────────────────────────────────────────────────────
  const [selectedLap, setSelectedLap] = useState(1);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [playSpeed,   setPlaySpeed]   = useState(1);
  const [driverDots,  setDriverDots]  = useState([]);

  const svgPathRef = useRef(null);
  const deadRef    = useRef(false);

  // ── Auto-play: advance one lap every (600 / speed) ms ───────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setSelectedLap(prev => {
        if (prev >= totalLaps) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, Math.round(600 / playSpeed));
    return () => clearInterval(id);
  }, [isPlaying, playSpeed, totalLaps]);

  // ── Recompute driver dots after each lap change ──────────────────────────
  useEffect(() => {
    const pathEl = svgPathRef.current;
    if (!pathEl || !allLaps.length || !totalLaps) { setDriverDots([]); return; }
    setDriverDots(computeDots(allLaps, selectedLap, totalLaps, driverMap, stints, pathEl));
  }, [allLaps, selectedLap, totalLaps, driverMap, stints, dataReady]);

  // ── Effect 1: load schedule + sessions ───────────────────────────────────
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      fetch(`${ERGAST}/2026.json`).then(r => r.json()),
      fetchWithRetry(`${OF1}/sessions?year=2026&session_name=Race`),
    ]).then(([erg, of1]) => {
      const races    = (erg?.MRData?.RaceTable?.Races || []).filter(r => r.date <= today);
      const sessions = Array.isArray(of1) ? of1 : [];
      setAllRaces(races);
      setOf1Sessions(sessions);
      if (races.length) setSelectedRace(races[races.length - 1]);
      setInitLoading(false);
    }).catch(() => setInitLoading(false));
  }, []);

  // ── Effect 2: load all race data when race changes ───────────────────────
  useEffect(() => {
    if (!selectedRace || !of1Sessions.length) return;
    deadRef.current = false;

    setError(null);
    setDataReady(false);
    setDriverMap({});
    setStints({});
    setAllLaps([]);
    setErgResults([]);
    setTotalLaps(0);
    setSelectedLap(1);
    setIsPlaying(false);
    setDriverDots([]);
    setLoadPct(2);
    setLoadStep(STEPS[0]);

    const country  = selectedRace.Circuit.Location.country.toLowerCase();
    const locality = selectedRace.Circuit.Location.locality.toLowerCase();
    const session  = of1Sessions.find(s => s.location?.toLowerCase() === locality)
                  || of1Sessions.find(s => s.country_name?.toLowerCase() === country);

    if (!session) {
      setError(`No OpenF1 session found for ${selectedRace.raceName}.`);
      setLoadStep(null);
      return;
    }

    const sk    = session.session_key;
    const round = selectedRace.round;

    (async () => {
      try {
        // Drivers
        setLoadStep(STEPS[1]); setLoadPct(15);
        const drvsD = await fetchWithRetry(`${OF1}/drivers?session_key=${sk}`);
        if (deadRef.current) return;
        const drvsArr = Array.isArray(drvsD) ? drvsD : [];
        if (!drvsArr.length) { setError("No driver data from OpenF1."); setLoadStep(null); return; }
        const drvsMap = {};
        drvsArr.forEach(d => { drvsMap[String(d.driver_number)] = d; });
        setDriverMap(drvsMap);

        // Laps
        setLoadStep(STEPS[2]); setLoadPct(45);
        const lapD = await fetchWithRetry(`${OF1}/laps?session_key=${sk}`);
        if (deadRef.current) return;
        const laps = Array.isArray(lapD) ? lapD : [];
        const maxLap = laps.reduce((m, l) => Math.max(m, l.lap_number || 0), 0);
        setAllLaps(laps);
        setTotalLaps(maxLap);
        setSelectedLap(maxLap || 1);

        // Stints (tyre data)
        setLoadStep(STEPS[3]); setLoadPct(72);
        const stD = await fetchWithRetry(`${OF1}/stints?session_key=${sk}`);
        if (deadRef.current) return;
        const stMap = {};
        (Array.isArray(stD) ? stD : []).forEach(s => {
          const k = String(s.driver_number);
          if (!stMap[k] || s.stint_number > stMap[k].stint_number) stMap[k] = s;
        });
        setStints(stMap);

        // Ergast official results
        const ergD = await fetch(`${ERGAST}/2026/${round}/results.json`).then(r => r.json());
        if (deadRef.current) return;
        setErgResults(ergD?.MRData?.RaceTable?.Races?.[0]?.Results || []);

        setLoadStep(STEPS[4]); setLoadPct(95);
        await new Promise(r => setTimeout(r, 150));
        if (deadRef.current) return;
        setLoadPct(100);
        setLoadStep(null);
        setDataReady(true);

      } catch (err) {
        if (deadRef.current) return;
        setError(`Failed to load: ${err.message}`);
        setLoadStep(null);
      }
    })();

    return () => { deadRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRace?.round, of1Sessions.length]);

  // ── Replay leaderboard (reactive to selectedLap) ─────────────────────────
  const replayLeaderboard = useMemo(() => {
    if (!allLaps.length) return [];
    const byDriver = {};
    for (const l of allLaps) {
      const k = String(l.driver_number);
      if (!byDriver[k]) byDriver[k] = [];
      byDriver[k].push(l);
    }
    const entries = Object.entries(byDriver).map(([num, laps]) => {
      const done   = laps
        .filter(l => l.lap_number != null && l.lap_number <= selectedLap && l.lap_duration != null)
        .sort((a, b) => a.lap_number - b.lap_number);
      const cumT   = done.reduce((s, l) => s + l.lap_duration, 0);
      const maxLap = done.reduce((m, l) => Math.max(m, l.lap_number || 0), 0);
      const lastL  = done.find(l => l.lap_number === maxLap);
      const drv    = driverMap[num] || {};
      const stint  = stints[num];
      return {
        num, code: drv.name_acronym || `#${num}`,
        fullName: drv.full_name || "",
        teamColor: drv.team_colour ? `#${drv.team_colour}` : "#888",
        lapsCompleted: maxLap, cumTime: cumT,
        lastLap: lastL?.lap_duration,
        compound: stint?.compound || "",
      };
    }).filter(d => d.lapsCompleted > 0)
      .sort((a, b) => b.lapsCompleted - a.lapsCompleted || a.cumTime - b.cumTime);

    const leaderCum  = entries[0]?.cumTime || 0;
    const leaderLaps = entries[0]?.lapsCompleted || 0;
    return entries.map((d, i) => ({
      ...d, position: i + 1,
      gap: i === 0
        ? formatLap(d.cumTime)
        : d.lapsCompleted < leaderLaps ? `+${leaderLaps - d.lapsCompleted}L`
        : `+${(d.cumTime - leaderCum).toFixed(3)}s`,
    }));
  }, [allLaps, selectedLap, driverMap, stints]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (initLoading) return (
    <div style={{ textAlign: "center", padding: "5rem", color: "#444", fontFamily: "monospace", fontSize: "0.8rem" }}>
      Loading schedule...
    </div>
  );
  if (allRaces.length === 0) return (
    <div style={{ textAlign: "center", padding: "5rem", color: "#444", fontFamily: "monospace", fontSize: "0.8rem" }}>
      No completed 2026 races yet.
    </div>
  );

  const isLoading   = loadStep !== null;
  const circuitPath = selectedRace ? CIRCUIT_PATHS[selectedRace.Circuit.Location.locality] : null;
  const lapPct      = totalLaps > 0 ? (selectedLap / totalLaps) * 100 : 0;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">

      {/* ── Race selector ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <SectionLabel>Select Race</SectionLabel>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {allRaces.map(race => {
            const active = selectedRace?.round === race.round;
            const flag   = COUNTRY_FLAGS[race.Circuit.Location.country] || "🏁";
            return (
              <motion.button
                key={race.round}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => !isLoading && setSelectedRace(race)}
                disabled={isLoading}
                style={{
                  background: active ? "rgba(225,6,0,0.18)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? accent + "88" : "rgba(255,255,255,0.07)"}`,
                  color: active ? "#fff" : "#555",
                  padding: "0.35rem 0.65rem", borderRadius: 6,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  fontSize: "0.72rem", whiteSpace: "nowrap", fontFamily: "inherit",
                  opacity: isLoading && !active ? 0.5 : 1,
                }}>
                {flag} {race.raceName.replace(" Grand Prix", "")}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Loading progress ── */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              background: "rgba(8,8,16,0.9)", border: `1px solid rgba(225,6,0,0.25)`,
              borderRadius: 10, padding: "1.25rem 1.5rem", marginBottom: "1.5rem",
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: accent, letterSpacing: "0.12em" }}>{loadStep}</span>
              <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "#555" }}>{loadPct}%</span>
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
              <motion.div
                animate={{ width: `${loadPct}%` }}
                transition={{ duration: 0.4 }}
                style={{ height: "100%", background: `linear-gradient(90deg, ${accent}, #ff6b35)`, borderRadius: 99 }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
              {STEPS.slice(0, -1).map((s, i) => {
                const stepPct = (i + 1) * (100 / (STEPS.length - 1));
                const done    = loadPct >= stepPct;
                const cur     = loadStep === s;
                return (
                  <span key={i} style={{
                    fontSize: "0.58rem", fontFamily: "monospace",
                    color: done ? "#00e472" : cur ? accent : "#333",
                    transition: "color 0.3s",
                  }}>
                    {done ? "✓" : cur ? "○" : "·"} {s.replace("...", "")}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              background: "rgba(225,6,0,0.08)", border: `1px solid ${accent}44`,
              borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.5rem",
            }}>
            <div style={{ fontSize: "0.8rem", color: "#f0a0a0" }}>⚠ {error}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main layout ── */}
      {dataReady && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem", alignItems: "start" }}>

          {/* Left: SVG circuit map + controls */}
          <div>
            <div style={{
              background: "#080812",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12, overflow: "hidden",
              marginBottom: "0.75rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}>
              <svg viewBox="0 0 500 300" style={{ width: "100%", display: "block" }}>
                <rect width="500" height="300" fill="#080812" />

                {circuitPath ? (
                  <>
                    {/* Track surface layers */}
                    <path d={circuitPath} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={circuitPath} fill="none" stroke="#1a1a2e" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={circuitPath} fill="none" stroke="#22223a" strokeWidth={6}  strokeLinecap="round" strokeLinejoin="round" />
                    {/* Racing line — ref used for getPointAtLength */}
                    <path
                      ref={svgPathRef}
                      d={circuitPath}
                      fill="none"
                      stroke="#2e2e4e"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                ) : (
                  <text x="250" y="150" fill="#2a2a3a" fontSize="11" fontFamily="monospace" textAnchor="middle">
                    Circuit map coming soon
                  </text>
                )}

                {/* Driver dots */}
                {driverDots.map(d => (
                  <g key={d.num}>
                    <circle cx={d.x} cy={d.y} r={9}  fill={d.color} opacity={0.18} />
                    <circle cx={d.x} cy={d.y} r={5}  fill={d.color} stroke="rgba(0,0,0,0.75)" strokeWidth={1.2} />
                    <text   x={d.x}  y={d.y - 9} fill={d.color} fontSize="6.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                      {d.code}
                    </text>
                  </g>
                ))}
              </svg>

              {/* Lap progress bar */}
              <div style={{ height: 3, background: "rgba(255,255,255,0.04)" }}>
                <motion.div
                  animate={{ width: `${lapPct}%` }}
                  transition={{ duration: 0.2 }}
                  style={{ height: "100%", background: `linear-gradient(90deg, ${accent}, #ff6b35)` }}
                />
              </div>
            </div>

            {/* Lap playback controls */}
            <div style={{
              background: "rgba(10,10,20,0.9)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "1rem 1.25rem", backdropFilter: "blur(12px)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.85rem" }}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsPlaying(v => !v)}
                  style={{
                    width: 38, height: 38, borderRadius: "50%", border: "none",
                    background: isPlaying
                      ? "linear-gradient(135deg, #f5c518, #e8a800)"
                      : `linear-gradient(135deg, ${accent}, #ff6b35)`,
                    color: "#000", fontWeight: 700, fontSize: "1rem", cursor: "pointer", flexShrink: 0,
                  }}>
                  {isPlaying ? "⏸" : "▶"}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setIsPlaying(false); setSelectedLap(1); }}
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
                    color: "#555", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0,
                  }}
                  title="Reset">↺</motion.button>
                <span style={{ fontSize: "0.78rem", fontFamily: "monospace", color: "#888" }}>
                  Lap <span style={{ color: "#fff" }}>{selectedLap}</span>
                  <span style={{ color: "#333" }}> / </span>
                  {totalLaps}
                </span>
                <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                  {[1, 2, 4].map(s => (
                    <motion.button key={s} whileTap={{ scale: 0.92 }} onClick={() => setPlaySpeed(s)} style={{
                      background: playSpeed === s ? "rgba(225,6,0,0.2)" : "transparent",
                      border: `1px solid ${playSpeed === s ? accent + "88" : "rgba(255,255,255,0.07)"}`,
                      color: playSpeed === s ? accent : "#555",
                      padding: "0.25rem 0.55rem", borderRadius: 5, cursor: "pointer",
                      fontSize: "0.65rem", fontFamily: "monospace", fontWeight: 700,
                    }}>{s}×</motion.button>
                  ))}
                </div>
              </div>
              <input
                type="range" min={1} max={totalLaps || 1} step={1}
                value={selectedLap}
                onChange={e => { setIsPlaying(false); setSelectedLap(Number(e.target.value)); }}
                style={{ width: "100%", marginBottom: "0.35rem" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.58rem", color: "#2a2a3a", fontFamily: "monospace" }}>
                <span>Lap 1</span>
                <span style={{ color: accent }}>Lap {selectedLap}</span>
                <span>Lap {totalLaps}</span>
              </div>
            </div>
          </div>

          {/* Right: leaderboard */}
          <div>
            <SectionLabel>Leaderboard — Lap {selectedLap}</SectionLabel>
            {replayLeaderboard.length > 0 ? (
              replayLeaderboard.map((d, i) => {
                const cColor = COMP_COLOR[d.compound] || "#444";
                const posClr = i === 0 ? accent : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#444";
                return (
                  <div key={d.num || i} style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.5rem 0.75rem",
                    background: i % 2 === 0 ? "rgba(14,14,26,0.8)" : "rgba(10,10,20,0.8)",
                    borderLeft: `3px solid ${d.teamColor}`,
                    marginBottom: 2, borderRadius: 6,
                  }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.8rem", width: 20, flexShrink: 0, color: posClr, fontWeight: 700 }}>{d.position}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.8rem", color: d.teamColor }}>{d.code}</span>
                        <span style={{ fontSize: "0.64rem", color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.fullName}</span>
                      </div>
                      <span style={{ fontSize: "0.58rem", color: "#333", fontFamily: "monospace" }}>L{d.lapsCompleted}</span>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "0.66rem", fontFamily: "monospace", color: i === 0 ? "#00e472" : "#555" }}>{d.gap}</div>
                      {d.lastLap && <div style={{ fontSize: "0.62rem", fontFamily: "monospace", color: "#444" }}>{formatLap(d.lastLap)}</div>}
                    </div>
                    {d.compound && (
                      <div style={{ fontSize: "0.6rem", fontWeight: 700, color: cColor, background: `${cColor}18`, border: `1px solid ${cColor}44`, borderRadius: 4, padding: "0.1rem 0.25rem", flexShrink: 0 }}>
                        {d.compound[0]}
                      </div>
                    )}
                  </div>
                );
              })
            ) : ergResults.length > 0 ? (
              <>
                <div style={{ fontSize: "0.62rem", color: "#333", fontFamily: "monospace", marginBottom: "0.5rem" }}>
                  Official race result (no lap-by-lap data)
                </div>
                {ergResults.slice(0, 12).map((r, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.45rem 0.75rem",
                    background: i % 2 === 0 ? "rgba(14,14,26,0.8)" : "rgba(10,10,20,0.8)",
                    marginBottom: 2, borderRadius: 6,
                  }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.75rem", width: 20, flexShrink: 0, color: i < 3 ? [accent, "#C0C0C0", "#CD7F32"][i] : "#333", fontWeight: 700 }}>{r.position}</span>
                    <span style={{ flex: 1, fontSize: "0.78rem" }}>{r.Driver.givenName} {r.Driver.familyName}</span>
                    <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "#555" }}>
                      {i === 0 ? (r.Time?.time || "—") : r.Time?.time ? `+${r.Time.time}` : r.status}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ color: "#333", padding: "2rem", textAlign: "center", fontSize: "0.78rem" }}>
                No lap data available.
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
