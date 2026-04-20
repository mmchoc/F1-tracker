import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionLabel, pageVariants } from "./ui";
import { ERGAST, OF1, COUNTRY_FLAGS, COMP_COLOR, theme, formatLap } from "../constants";

const { accent } = theme;

// ── Circuit GeoJSON source ────────────────────────────────────────────────────
// bacinger/f1-circuits: GeoJSON LineString with [lon, lat] pairs
const GEOJSON_BASE = "https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits";

// Maps Ergast circuitId → bacinger file id (without .geojson)
const CIRCUIT_FILES = {
  albert_park:   "au-1953",
  shanghai:      "cn-2004",
  suzuka:        "jp-1962",
  bahrain:       "bh-2002",
  jeddah:        "sa-2021",
  monaco:        "mc-1929",
  villeneuve:    "ca-1978",
  catalunya:     "es-2026",
  red_bull_ring: "at-1969",
  silverstone:   "gb-1948",
  hungaroring:   "hu-1986",
  spa:           "be-1925",
  zandvoort:     "nl-1948",
  monza:         "it-1953",
  baku:          "az-2016",
  marina_bay:    "sg-2008",
  americas:      "us-2012",
  rodriguez:     "mx-1962",
  interlagos:    "br-1977",
  vegas:         "us-2023",
  losail:        "qa-2004",
  yas_marina:    "ae-2009",
  // miami and imola not yet in bacinger repo
};

// ── Circuit coordinate helpers ────────────────────────────────────────────────

async function fetchCircuitPoints(ergastCircuitId) {
  const fileId = CIRCUIT_FILES[ergastCircuitId];
  if (!fileId) return [];
  try {
    const res = await fetch(`${GEOJSON_BASE}/${fileId}.geojson`);
    if (!res.ok) return [];
    const geo  = await res.json();
    const coords = geo?.features?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || !coords.length) return [];
    return normalizeGeoCoords(coords);
  } catch {
    return [];
  }
}

// Scale [lon, lat] pairs to fit a 1000×1000 SVG, preserving aspect ratio.
// Y axis is flipped so north is up.
function normalizeGeoCoords(coords, W = 1000, H = 1000, pad = 70) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const rLon  = maxLon - minLon || 1;
  const rLat  = maxLat - minLat || 1;
  const scale = Math.min((W - pad * 2) / rLon, (H - pad * 2) / rLat);
  const ox    = (W - rLon * scale) / 2;
  const oy    = (H - rLat * scale) / 2;
  return coords.map(([lon, lat]) => ({
    x: ox + (lon - minLon) * scale,
    y: H - (oy + (lat - minLat) * scale), // flip Y: north → top
  }));
}

// Build cumulative distance table including the closing segment.
function buildCumDists(pts) {
  if (pts.length < 2) return { cumDists: [0], total: 0 };
  const cumDists = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    cumDists.push(cumDists[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const last   = pts[pts.length - 1];
  const closeDx = pts[0].x - last.x;
  const closeDy = pts[0].y - last.y;
  const total  = cumDists[cumDists.length - 1] + Math.sqrt(closeDx * closeDx + closeDy * closeDy);
  return { cumDists, total };
}

// Interpolate a point along the closed circuit at progress ∈ [0, 1).
function getPointAtProgress(pts, cumDists, total, progress) {
  if (!pts.length || !total) return { x: 500, y: 500 };
  const target  = ((progress % 1) + 1) % 1 * total;
  const maxDist = cumDists[cumDists.length - 1];

  if (target >= maxDist) {
    // In the closing segment (last → first point)
    const segLen = total - maxDist;
    const alpha  = segLen > 0 ? (target - maxDist) / segLen : 0;
    const a = pts[pts.length - 1], b = pts[0];
    return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
  }

  let lo = 0, hi = cumDists.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumDists[mid] <= target) lo = mid; else hi = mid;
  }
  const a = pts[lo], b = pts[hi];
  const segLen = cumDists[hi] - cumDists[lo];
  const alpha  = segLen > 0 ? (target - cumDists[lo]) / segLen : 0;
  return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
}

// Convert point array to a closed SVG path string.
function pointsToPath(pts) {
  if (!pts.length) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + "Z";
}

// ── Race data helpers ─────────────────────────────────────────────────────────

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
  "Loading circuit...",
  "Loading drivers...",
  "Loading laps...",
  "Loading tyre data...",
  "Processing...",
  "Ready",
];

// ── Driver dot placement ──────────────────────────────────────────────────────
// Leader anchored at progress 0; each trailing driver placed proportionally
// behind by their cumulative time gap vs. the average lap time.
function computeDots(allLaps, selectedLap, totalLaps, driverMap, stints, pts, cumDists, total) {
  if (!pts.length || !allLaps.length || !totalLaps) return [];

  const byDriver = {};
  for (const l of allLaps) {
    const k = String(l.driver_number);
    if (!byDriver[k]) byDriver[k] = [];
    byDriver[k].push(l);
  }

  const entries = Object.entries(byDriver).map(([num, laps]) => {
    const done    = laps
      .filter(l => l.lap_number != null && l.lap_number <= selectedLap && l.lap_duration != null)
      .sort((a, b) => a.lap_number - b.lap_number);
    const cumTime = done.reduce((s, l) => s + l.lap_duration, 0);
    return { num, cumTime, lapsCompleted: done.length };
  }).filter(d => d.lapsCompleted > 0);

  if (!entries.length) return [];

  entries.sort((a, b) => b.lapsCompleted - a.lapsCompleted || a.cumTime - b.cumTime);
  const leader     = entries[0];
  const avgLapTime = leader.lapsCompleted > 0 ? leader.cumTime / leader.lapsCompleted : 90;

  return entries.map(d => {
    const gap      = d.cumTime - leader.cumTime;
    const lapFrac  = gap / avgLapTime;
    const progress = (((-lapFrac) % 1) + 1) % 1;
    const pt       = getPointAtProgress(pts, cumDists, total, progress);
    const drv      = driverMap[d.num] || {};
    const stint    = stints[d.num];
    return {
      num: d.num,
      x: pt.x, y: pt.y,
      color: drv.team_colour ? `#${drv.team_colour}` : "#888",
      code:  drv.name_acronym || `#${d.num}`,
      lapsCompleted: d.lapsCompleted,
      compound: stint?.compound || "",
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  const [driverMap,      setDriverMap]      = useState({});
  const [stints,         setStints]         = useState({});
  const [allLaps,        setAllLaps]        = useState([]);
  const [ergResults,     setErgResults]     = useState([]);
  const [totalLaps,      setTotalLaps]      = useState(0);
  const [circuitPoints,  setCircuitPoints]  = useState([]);

  // ── lap replay (React state — drives UI only) ────────────────────────────
  const [selectedLap, setSelectedLap] = useState(1);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [playSpeed,   setPlaySpeed]   = useState(1);
  const [driverDots,  setDriverDots]  = useState([]);

  // ── Refs for RAF loop — zero re-renders during animation ─────────────────
  const deadRef        = useRef(false);
  const isPlayingRef   = useRef(false);
  const playSpeedRef   = useRef(1);
  const totalLapsRef   = useRef(0);
  const currentLapRef  = useRef(1);
  const lastLapTimeRef = useRef(null);
  const rafRef         = useRef(null);

  useEffect(() => { isPlayingRef.current = isPlaying;  }, [isPlaying]);
  useEffect(() => { playSpeedRef.current = playSpeed;  }, [playSpeed]);
  useEffect(() => { totalLapsRef.current = totalLaps;  }, [totalLaps]);

  // ── RAF loop — mounted once, never torn down ─────────────────────────────
  // Advances currentLapRef at the correct rate; setSelectedLap fires only
  // on integer lap changes (not every frame).
  useEffect(() => {
    const tick = (ts) => {
      if (isPlayingRef.current) {
        if (lastLapTimeRef.current === null) {
          lastLapTimeRef.current = ts;
        } else {
          const elapsed  = ts - lastLapTimeRef.current;
          const msPerLap = 600 / playSpeedRef.current;
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
  }, []); // mount only

  // ── Recompute driver dots whenever selectedLap or circuit changes ─────────
  useEffect(() => {
    if (!circuitPoints.length || !allLaps.length || !totalLaps) { setDriverDots([]); return; }
    const { cumDists, total } = buildCumDists(circuitPoints);
    setDriverDots(computeDots(allLaps, selectedLap, totalLaps, driverMap, stints, circuitPoints, cumDists, total));
  }, [allLaps, selectedLap, totalLaps, driverMap, stints, circuitPoints]);

  // ── Control handlers ─────────────────────────────────────────────────────
  const handlePlayToggle = useCallback(() => {
    const next = !isPlayingRef.current;
    isPlayingRef.current = next;
    if (next) lastLapTimeRef.current = null;
    setIsPlaying(next);
  }, []);

  const handleScrub = useCallback((val) => {
    const lap = Number(val);
    currentLapRef.current  = lap;
    lastLapTimeRef.current = null;
    isPlayingRef.current   = false;
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

  // ── Effect 2: load race data when race changes ────────────────────────────
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
    setCircuitPoints([]);
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
        // Circuit GeoJSON
        setLoadStep(STEPS[1]); setLoadPct(8);
        const pts = await fetchCircuitPoints(selectedRace.Circuit.circuitId);
        if (deadRef.current) return;
        setCircuitPoints(pts);

        // Drivers
        setLoadStep(STEPS[2]); setLoadPct(22);
        const drvsD = await fetchWithRetry(`${OF1}/drivers?session_key=${sk}`);
        if (deadRef.current) return;
        const drvsArr = Array.isArray(drvsD) ? drvsD : [];
        if (!drvsArr.length) { setError("No driver data from OpenF1."); setLoadStep(null); return; }
        const drvsMap = {};
        drvsArr.forEach(d => { drvsMap[String(d.driver_number)] = d; });
        setDriverMap(drvsMap);

        // Laps
        setLoadStep(STEPS[3]); setLoadPct(48);
        const lapD = await fetchWithRetry(`${OF1}/laps?session_key=${sk}`);
        if (deadRef.current) return;
        const laps   = Array.isArray(lapD) ? lapD : [];
        const maxLap = laps.reduce((m, l) => Math.max(m, l.lap_number || 0), 0);
        setAllLaps(laps);
        setTotalLaps(maxLap);
        totalLapsRef.current  = maxLap;
        currentLapRef.current = maxLap || 1;
        setSelectedLap(maxLap || 1);

        // Stints
        setLoadStep(STEPS[4]); setLoadPct(72);
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

        setLoadStep(STEPS[5]); setLoadPct(95);
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

  // ── Replay leaderboard ────────────────────────────────────────────────────
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

  // ── Memoised SVG path string ──────────────────────────────────────────────
  const circuitPathStr = useMemo(() => pointsToPath(circuitPoints), [circuitPoints]);

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

                {circuitPathStr ? (
                  <>
                    <path d={circuitPathStr} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={circuitPathStr} fill="none" stroke="#1a1a2e" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={circuitPathStr} fill="none" stroke="#232340" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={circuitPathStr} fill="none" stroke="#2e2e50" strokeWidth={4}  strokeLinecap="round" strokeLinejoin="round" />
                  </>
                ) : (
                  <text x="500" y="500" fill="#2a2a3a" fontSize="22" fontFamily="monospace" textAnchor="middle">
                    Circuit data not available
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
                    <circle r={18} fill={d.color} opacity={0.15} />
                    <circle r={10} fill={d.color} stroke="rgba(0,0,0,0.8)" strokeWidth={2} />
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
