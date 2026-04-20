import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionLabel, pageVariants } from "./ui";
import { ERGAST, OF1, COUNTRY_FLAGS, COMP_COLOR, theme, formatLap } from "../constants";

const { accent } = theme;

// ── SVG circuit paths — viewBox 0 0 1000 1000 ─────────────────────────────────
// Keyed by Ergast locality name. Progress 0→1 follows racing direction.
const CIRCUIT_PATHS = {
  // Australia — Albert Park
  "Melbourne": "M 500,200 C 600,200 700,250 720,350 C 740,450 700,500 650,520 C 600,540 550,530 520,560 C 490,590 480,630 450,650 C 420,670 380,670 350,650 C 320,630 300,590 280,560 C 260,530 240,510 220,490 C 200,470 190,440 200,400 C 210,360 240,330 270,310 C 300,290 340,280 370,270 C 400,260 450,200 500,200 Z",

  // Japan — Suzuka (figure-8)
  "Suzuka": "M 400,300 C 450,250 520,240 560,280 C 600,320 610,380 580,420 C 560,445 530,455 510,470 C 530,485 560,495 580,520 C 610,560 600,620 560,650 C 520,680 450,670 410,640 C 370,610 350,560 360,510 C 365,485 380,470 400,460 C 420,450 440,445 450,430 C 460,415 455,395 440,375 C 420,350 390,330 400,300 Z",

  // China — Shanghai
  "Shanghai": "M 300,250 C 400,220 550,220 650,250 C 720,270 760,310 770,370 C 780,430 750,480 700,500 C 680,508 655,510 640,525 C 625,540 620,560 610,580 C 595,608 570,625 540,630 C 510,635 480,625 460,608 C 440,590 435,565 420,548 C 405,530 380,520 360,510 C 310,488 270,450 260,400 C 250,350 260,290 300,250 Z",

  // Bahrain — Sakhir
  "Sakhir": "M 350,200 C 450,180 570,190 640,240 C 700,280 720,340 710,400 C 700,450 670,490 640,510 C 610,530 570,535 540,550 C 510,565 490,590 470,610 C 445,635 410,645 380,635 C 350,625 325,600 310,570 C 295,540 295,505 300,475 C 305,445 320,420 320,390 C 320,360 305,330 300,300 C 290,260 310,215 350,200 Z",

  // Saudi Arabia — Jeddah
  "Jeddah": "M 480,150 C 530,145 580,155 610,185 C 635,210 640,245 635,280 C 630,310 615,335 610,365 C 605,395 610,425 605,455 C 600,490 580,520 555,540 C 530,560 498,565 475,550 C 452,535 440,508 435,480 C 430,452 435,422 430,392 C 425,362 410,335 405,305 C 400,272 405,237 425,212 C 445,187 465,153 480,150 Z",
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

const STEPS = [
  "Fetching session...",
  "Loading drivers...",
  "Loading laps...",
  "Loading tyre data...",
  "Processing...",
  "Ready",
];

// ── Compute driver dot positions using SVG path ───────────────────────────────
// Leader anchored at progress 0; each trailing driver spread behind proportionally
// by time gap relative to average lap time.
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
  const leader      = entries[0];
  const avgLapTime  = leader.lapsCompleted > 0 ? leader.cumTime / leader.lapsCompleted : 90;

  return entries.map(d => {
    const gap      = d.cumTime - leader.cumTime;
    const lapFrac  = gap / avgLapTime;
    const progress = (((-lapFrac) % 1) + 1) % 1;
    const pt       = pathEl.getPointAtLength(progress * totalLen);
    const drv      = driverMap[d.num] || {};
    const stint    = stints[d.num];
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

  // ── lap replay (React state — UI only) ──────────────────────────────────
  const [selectedLap, setSelectedLap] = useState(1);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [playSpeed,   setPlaySpeed]   = useState(1);
  const [driverDots,  setDriverDots]  = useState([]);

  // ── Refs for RAF loop — never trigger re-renders ─────────────────────────
  const svgPathRef      = useRef(null);
  const deadRef         = useRef(false);
  const isPlayingRef    = useRef(false);
  const playSpeedRef    = useRef(1);
  const totalLapsRef    = useRef(0);
  const currentLapRef   = useRef(1);
  const lastLapTimeRef  = useRef(null);
  const rafRef          = useRef(null);

  // Keep refs in sync with state (safe to call in render — no side effects)
  useEffect(() => { isPlayingRef.current  = isPlaying;  }, [isPlaying]);
  useEffect(() => { playSpeedRef.current  = playSpeed;  }, [playSpeed]);
  useEffect(() => { totalLapsRef.current  = totalLaps;  }, [totalLaps]);

  // ── RAF animation loop — mounted once, never torn down ───────────────────
  // Advances currentLapRef at the correct rate; React state updated only when
  // the integer lap changes (not every frame).
  useEffect(() => {
    const tick = (ts) => {
      if (isPlayingRef.current) {
        if (lastLapTimeRef.current === null) {
          lastLapTimeRef.current = ts;
        } else {
          const msPerLap = 600 / playSpeedRef.current;
          const elapsed  = ts - lastLapTimeRef.current;
          if (elapsed >= msPerLap) {
            lastLapTimeRef.current = ts - (elapsed % msPerLap);
            const next = currentLapRef.current + 1;
            if (next > totalLapsRef.current) {
              isPlayingRef.current = false;
              setIsPlaying(false);
            } else {
              currentLapRef.current = next;
              setSelectedLap(next);
            }
          }
        }
      } else {
        lastLapTimeRef.current = null;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // mount only — all mutable state accessed via refs

  // ── Recompute driver dots when selectedLap or data changes ───────────────
  useEffect(() => {
    const pathEl = svgPathRef.current;
    if (!pathEl || !allLaps.length || !totalLaps) { setDriverDots([]); return; }
    setDriverDots(computeDots(allLaps, selectedLap, totalLaps, driverMap, stints, pathEl));
  }, [allLaps, selectedLap, totalLaps, driverMap, stints, dataReady]);

  // ── Control handlers ─────────────────────────────────────────────────────
  const handlePlayToggle = useCallback(() => {
    const next = !isPlayingRef.current;
    isPlayingRef.current = next;
    if (next) lastLapTimeRef.current = null;
    setIsPlaying(next);
  }, []);

  const handleScrub = useCallback((val) => {
    const lap = Number(val);
    currentLapRef.current    = lap;
    lastLapTimeRef.current   = null;
    isPlayingRef.current     = false;
    setIsPlaying(false);
    setSelectedLap(lap);
  }, []);

  const handleReset = useCallback(() => {
    currentLapRef.current  = 1;
    lastLapTimeRef.current = null;
    isPlayingRef.current   = false;
    setIsPlaying(false);
    setSelectedLap(1);
  }, []);

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
    setDriverDots([]);
    isPlayingRef.current   = false;
    currentLapRef.current  = 1;
    lastLapTimeRef.current = null;
    setIsPlaying(false);
    setSelectedLap(1);
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
        setLoadStep(STEPS[1]); setLoadPct(15);
        const drvsD = await fetchWithRetry(`${OF1}/drivers?session_key=${sk}`);
        if (deadRef.current) return;
        const drvsArr = Array.isArray(drvsD) ? drvsD : [];
        if (!drvsArr.length) { setError("No driver data from OpenF1."); setLoadStep(null); return; }
        const drvsMap = {};
        drvsArr.forEach(d => { drvsMap[String(d.driver_number)] = d; });
        setDriverMap(drvsMap);

        setLoadStep(STEPS[2]); setLoadPct(45);
        const lapD = await fetchWithRetry(`${OF1}/laps?session_key=${sk}`);
        if (deadRef.current) return;
        const laps   = Array.isArray(lapD) ? lapD : [];
        const maxLap = laps.reduce((m, l) => Math.max(m, l.lap_number || 0), 0);
        setAllLaps(laps);
        setTotalLaps(maxLap);
        totalLapsRef.current  = maxLap;
        currentLapRef.current = maxLap || 1;
        setSelectedLap(maxLap || 1);

        setLoadStep(STEPS[3]); setLoadPct(72);
        const stD = await fetchWithRetry(`${OF1}/stints?session_key=${sk}`);
        if (deadRef.current) return;
        const stMap = {};
        (Array.isArray(stD) ? stD : []).forEach(s => {
          const k = String(s.driver_number);
          if (!stMap[k] || s.stint_number > stMap[k].stint_number) stMap[k] = s;
        });
        setStints(stMap);

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

  const isLoadingData = loadStep !== null;
  const circuitPath   = selectedRace ? CIRCUIT_PATHS[selectedRace.Circuit.Location.locality] : null;
  const lapPct        = totalLaps > 0 ? (selectedLap / totalLaps) * 100 : 0;

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
                onClick={() => !isLoadingData && setSelectedRace(race)}
                disabled={isLoadingData}
                style={{
                  background: active ? "rgba(225,6,0,0.18)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? accent + "88" : "rgba(255,255,255,0.07)"}`,
                  color: active ? "#fff" : "#555",
                  padding: "0.35rem 0.65rem", borderRadius: 6,
                  cursor: isLoadingData ? "not-allowed" : "pointer",
                  fontSize: "0.72rem", whiteSpace: "nowrap", fontFamily: "inherit",
                  opacity: isLoadingData && !active ? 0.5 : 1,
                }}>
                {flag} {race.raceName.replace(" Grand Prix", "")}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Loading progress ── */}
      <AnimatePresence>
        {isLoadingData && (
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

          {/* Left: SVG circuit map + playback controls */}
          <div>
            <div style={{
              background: "#080812",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12, overflow: "hidden",
              marginBottom: "0.75rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}>
              <svg viewBox="0 0 1000 1000" style={{ width: "100%", display: "block" }}>
                <rect width="1000" height="1000" fill="#080812" />

                {circuitPath ? (
                  <>
                    {/* Track surface — layered for depth */}
                    <path d={circuitPath} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={circuitPath} fill="none" stroke="#1a1a2e" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={circuitPath} fill="none" stroke="#222236" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
                    {/* Racing line — ref used for getPointAtLength */}
                    <path
                      ref={svgPathRef}
                      d={circuitPath}
                      fill="none"
                      stroke="#2e2e50"
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                ) : (
                  <text x="500" y="500" fill="#2a2a3a" fontSize="22" fontFamily="monospace" textAnchor="middle">
                    Circuit map coming soon
                  </text>
                )}

                {/* Driver dots — Framer Motion animates x/y in SVG user units */}
                {driverDots.map(d => (
                  <motion.g
                    key={d.num}
                    initial={false}
                    animate={{ x: d.x, y: d.y }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    {/* Glow halo */}
                    <circle r={18} fill={d.color} opacity={0.15} />
                    {/* Main dot */}
                    <circle r={10} fill={d.color} stroke="rgba(0,0,0,0.8)" strokeWidth={2} />
                    {/* Driver code label */}
                    <text y={-15} fill={d.color} fontSize="13" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                      {d.code}
                    </text>
                  </motion.g>
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

            {/* Playback controls */}
            <div style={{
              background: "rgba(10,10,20,0.9)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "1rem 1.25rem", backdropFilter: "blur(12px)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.85rem" }}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handlePlayToggle}
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
                  onClick={handleReset}
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
                onChange={e => handleScrub(e.target.value)}
                style={{ width: "100%", marginBottom: "0.35rem" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.58rem", color: "#2a2a3a", fontFamily: "monospace" }}>
                <span>Lap 1</span>
                <span style={{ color: accent }}>Lap {selectedLap}</span>
                <span>Lap {totalLaps}</span>
              </div>
            </div>
          </div>

          {/* Right: leaderboard with layout animations */}
          <div>
            <SectionLabel>Leaderboard — Lap {selectedLap}</SectionLabel>
            {replayLeaderboard.length > 0 ? (
              <motion.div layout>
                <AnimatePresence mode="popLayout" initial={false}>
                  {replayLeaderboard.map((d, i) => {
                    const cColor = COMP_COLOR[d.compound] || "#444";
                    const posClr = i === 0 ? accent : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#444";
                    return (
                      <motion.div
                        key={d.num}
                        layout="position"
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ layout: { duration: 0.3, ease: "easeOut" }, duration: 0.2 }}
                        style={{
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
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
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
