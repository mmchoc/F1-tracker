import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionLabel, pageVariants } from "./ui";
import { ERGAST, OF1, COUNTRY_FLAGS, COMP_COLOR, theme, formatLap } from "../constants";

const { accent } = theme;
const CW = 900, CH = 500, PAD = 30;

// ── Canvas helpers ────────────────────────────────────────────────────────────
function normPt(raw, bounds) {
  const x = PAD + ((raw.x - bounds.minX) / bounds.w) * (CW - PAD * 2);
  const y = PAD + (1 - (raw.y - bounds.minY) / bounds.h) * (CH - PAD * 2);
  return (isFinite(x) && isFinite(y)) ? { x, y } : null;
}

function lerpPos(samples, t) {
  if (!samples || !samples.length) return null;
  if (t <= samples[0].t) return samples[0];
  const last = samples[samples.length - 1];
  if (t >= last.t) return last;
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  const alpha = (t - a.t) / (b.t - a.t);
  return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
}

function drawTrackOnce(ctx, trackPts, bounds) {
  ctx.clearRect(0, 0, CW, CH);
  if (!trackPts.length || !bounds) return;
  ctx.save();
  ctx.strokeStyle = "#1e1e32";
  ctx.lineWidth = 14;
  ctx.lineJoin = "round";
  ctx.lineCap  = "round";
  ctx.beginPath();
  let first = true;
  for (const raw of trackPts) {
    const pt = normPt(raw, bounds);
    if (!pt) continue;
    if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
    else ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = "#3a3a5a";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

function drawDriversFrame(ctx, posMap, driverMap, bounds, activeNums, currentT) {
  ctx.clearRect(0, 0, CW, CH);
  if (!bounds) return;
  for (const num of activeNums) {
    const samples = posMap.get(num);
    if (!samples) continue;
    const raw = lerpPos(samples, currentT);
    if (!raw) continue;
    const pt = normPt(raw, bounds);
    if (!pt) continue;
    const drv = driverMap[num] || {};
    const col = drv.team_colour ? `#${drv.team_colour}` : "#888";
    const code = (drv.name_acronym || num).slice(0, 3);
    ctx.save();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = col;
    ctx.fillText(code, pt.x, pt.y - 8);
    ctx.restore();
  }
}

// ── Downsample: 1 sample per STEP_S seconds per driver ───────────────────────
const STEP_S = 10;
function downsampleByDriver(locArray) {
  if (!locArray.length) return new Map();
  const sessionStart = new Date(locArray[0].date).getTime();
  const byDriver = new Map();
  for (const loc of locArray) {
    const k = String(loc.driver_number);
    if (!byDriver.has(k)) byDriver.set(k, []);
    byDriver.get(k).push({
      t: (new Date(loc.date).getTime() - sessionStart) / 1000,
      x: loc.x, y: loc.y,
    });
  }
  const result = new Map();
  byDriver.forEach((pts, num) => {
    pts.sort((a, b) => a.t - b.t);
    const out = [];
    let last = -Infinity;
    for (const p of pts) {
      if (p.t - last >= STEP_S) { out.push(p); last = p.t; }
    }
    if (out.length) result.set(num, out);
  });
  return result;
}

function buildTrack(locArray, bounds) {
  // Take all points from the session start window (first ~3 min) from all drivers
  // combined — this sketches the circuit shape
  const sessionStart = new Date(locArray[0].date).getTime();
  const pts = locArray
    .filter(p => (new Date(p.date).getTime() - sessionStart) / 1000 < 200)
    .filter((_, i) => i % 4 === 0);
  return pts;
}

function computeBounds(locArray) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of locArray) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY, w: maxX - minX || 1, h: maxY - minY || 1 };
}

// ── Load step labels ──────────────────────────────────────────────────────────
const STEPS = [
  "Fetching session...",
  "Loading drivers...",
  "Loading positions (this may take 30s)...",
  "Loading laps...",
  "Loading tyre data...",
  "Processing replay data...",
  "Ready",
];

export default function RaceReplayTab() {
  // ── schedule / session ───────────────────────────────────────────────────
  const [allRaces,     setAllRaces]     = useState([]);
  const [of1Sessions,  setOf1Sessions]  = useState([]);
  const [selectedRace, setSelectedRace] = useState(null);
  const [initLoading,  setInitLoading]  = useState(true);

  // ── per-race data load ───────────────────────────────────────────────────
  const [loadStep,     setLoadStep]     = useState(null);   // null = idle
  const [loadPct,      setLoadPct]      = useState(0);
  const [error,        setError]        = useState(null);
  const [dataReady,    setDataReady]    = useState(false);

  // ── race data ────────────────────────────────────────────────────────────
  const [driverMap,    setDriverMap]    = useState({});     // num → OF1 driver obj
  const [stints,       setStints]       = useState({});     // num → last stint
  const [allLaps,      setAllLaps]      = useState([]);
  const [ergResults,   setErgResults]   = useState([]);
  const [hasGPS,       setHasGPS]       = useState(false);

  // ── canvas / replay ──────────────────────────────────────────────────────
  const [trackPts,     setTrackPts]     = useState([]);
  const [trackBounds,  setTrackBounds]  = useState(null);
  const [totalDur,     setTotalDur]     = useState(0);
  const [currentT,     setCurrentT]     = useState(0);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [playSpeed,    setPlaySpeed]    = useState(1);

  // Refs for RAF — never triggers re-renders during animation
  const bgCanvasRef    = useRef(null);
  const fgCanvasRef    = useRef(null);
  const posDataRef     = useRef(new Map());   // Map<num, [{t,x,y}]>
  const activeNumsRef  = useRef([]);
  const driverMapRef   = useRef({});
  const boundsRef      = useRef(null);
  const trackPtsRef    = useRef([]);
  const currentTRef    = useRef(0);
  const totalDurRef    = useRef(0);
  const isPlayingRef   = useRef(false);
  const playSpeedRef   = useRef(1);
  const lastTsRef      = useRef(null);
  const rafRef         = useRef(null);
  const deadRef        = useRef(false);

  // Sync simple refs
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { playSpeedRef.current = playSpeed; }, [playSpeed]);
  useEffect(() => { driverMapRef.current = driverMap; }, [driverMap]);
  useEffect(() => { boundsRef.current = trackBounds; }, [trackBounds]);
  useEffect(() => { trackPtsRef.current = trackPts; }, [trackPts]);

  // Draw track on bg canvas whenever it updates
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas || !trackPts.length || !trackBounds) return;
    const ctx = canvas.getContext("2d");
    drawTrackOnce(ctx, trackPts, trackBounds);
  }, [trackPts, trackBounds]);

  // Main RAF loop — pure canvas draws, zero React state updates here
  useEffect(() => {
    let cancelled = false;
    const tick = (ts) => {
      if (cancelled) return;
      if (isPlayingRef.current && lastTsRef.current !== null) {
        const dt = (ts - lastTsRef.current) / 1000;
        const next = Math.min(currentTRef.current + dt * playSpeedRef.current, totalDurRef.current);
        currentTRef.current = next;
        if (next >= totalDurRef.current) {
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      }
      lastTsRef.current = ts;
      const canvas = fgCanvasRef.current;
      if (canvas && boundsRef.current && posDataRef.current.size > 0) {
        const ctx = canvas.getContext("2d");
        drawDriversFrame(ctx, posDataRef.current, driverMapRef.current, boundsRef.current, activeNumsRef.current, currentTRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelled = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Poll currentTRef → setCurrentT every 200ms so the scrubber stays in sync
  useEffect(() => {
    const id = setInterval(() => setCurrentT(currentTRef.current), 200);
    return () => clearInterval(id);
  }, []);

  // ── Effect 1: initial schedule + sessions ────────────────────────────────
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      fetch(`${ERGAST}/2026.json`).then(r => r.json()),
      fetch(`${OF1}/sessions?year=2026&session_name=Race`).then(r => r.json()),
    ]).then(([erg, of1]) => {
      const races = (erg?.MRData?.RaceTable?.Races || []).filter(r => r.date <= today);
      const sessions = Array.isArray(of1) ? of1 : [];
      console.log("[RaceReplay] Ergast races:", races.length, "| OpenF1 sessions:", sessions.length);
      setAllRaces(races);
      setOf1Sessions(sessions);
      if (races.length) setSelectedRace(races[races.length - 1]);
      setInitLoading(false);
    }).catch(err => {
      console.error("[RaceReplay] Schedule load failed:", err);
      setInitLoading(false);
    });
  }, []);

  // ── Effect 2: load all race data when race is selected ───────────────────
  useEffect(() => {
    if (!selectedRace || !of1Sessions.length) return;
    deadRef.current = false;

    // Reset everything
    setError(null);
    setDataReady(false);
    setHasGPS(false);
    setDriverMap({});
    setStints({});
    setAllLaps([]);
    setErgResults([]);
    setTrackPts([]);
    setTrackBounds(null);
    setTotalDur(0);
    setCurrentT(0);
    setIsPlaying(false);
    isPlayingRef.current = false;
    currentTRef.current = 0;
    totalDurRef.current = 0;
    posDataRef.current = new Map();
    activeNumsRef.current = [];
    lastTsRef.current = null;

    // Clear canvases
    [bgCanvasRef, fgCanvasRef].forEach(ref => {
      const ctx = ref.current?.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, CW, CH);
    });

    // Match race to OpenF1 session
    setLoadPct(2);
    setLoadStep(STEPS[0]); // "Fetching session..."
    const country  = selectedRace.Circuit.Location.country.toLowerCase();
    const locality = selectedRace.Circuit.Location.locality.toLowerCase();
    const session  = of1Sessions.find(s => s.location?.toLowerCase() === locality)
                  || of1Sessions.find(s => s.country_name?.toLowerCase() === country);

    if (!session) {
      setError(`No OpenF1 session found for ${selectedRace.raceName}. This race may not have OpenF1 data yet.`);
      setLoadStep(null);
      return;
    }
    console.log("[RaceReplay] Matched session:", session);

    const sk = session.session_key;
    const round = selectedRace.round;

    (async () => {
      try {
        // ── Step: drivers ────────────────────────────────────────────────
        setLoadStep(STEPS[1]); setLoadPct(10);
        const drvsR = await fetch(`${OF1}/drivers?session_key=${sk}`);
        const drvsD = await drvsR.json();
        console.log("[RaceReplay] OpenF1 /drivers response:", drvsD);
        if (deadRef.current) return;
        const drvsArr = Array.isArray(drvsD) ? drvsD : [];
        if (drvsArr.length === 0) {
          setError("No driver data returned from OpenF1 for this session.");
          setLoadStep(null); return;
        }
        const drvsMap = {};
        drvsArr.forEach(d => { drvsMap[String(d.driver_number)] = d; });
        setDriverMap(drvsMap);
        driverMapRef.current = drvsMap;

        // ── Step: GPS location (for canvas) ──────────────────────────────
        setLoadStep(STEPS[2]); setLoadPct(20);
        let locArray = [];
        {
          // Try fetching all location data in one request
          const locR = await fetch(`${OF1}/location?session_key=${sk}`);
          const locD = await locR.json();
          console.log("[RaceReplay] OpenF1 /location response:", Array.isArray(locD) ? `${locD.length} GPS points` : locD);
          if (deadRef.current) return;
          locArray = Array.isArray(locD) ? locD : [];
        }

        if (locArray.length < 100) {
          console.warn("[RaceReplay] < 100 GPS points returned — canvas map will be hidden. Trying per-driver fallback...");
          // Fallback: fetch per driver with time window
          if (drvsArr.length > 0 && session.date_start && session.date_end) {
            const tFrom = session.date_start;
            const tTo   = session.date_end;
            const results = await Promise.allSettled(
              drvsArr.slice(0, 6).map(d =>
                fetch(`${OF1}/location?session_key=${sk}&driver_number=${d.driver_number}&date>${tFrom}&date<${tTo}`)
                  .then(r => r.json())
                  .then(d => Array.isArray(d) ? d : [])
              )
            );
            if (deadRef.current) return;
            results.forEach(res => { if (res.status === "fulfilled") locArray.push(...res.value); });
            console.log("[RaceReplay] Per-driver fallback location data:", locArray.length, "points");
          }
        }

        if (locArray.length >= 100) {
          setHasGPS(true);
          locArray.sort((a, b) => new Date(a.date) - new Date(b.date));
          const bounds = computeBounds(locArray);
          console.log("[RaceReplay] GPS bounds:", bounds);
          const track  = buildTrack(locArray, bounds);
          const posMap = downsampleByDriver(locArray);
          console.log("[RaceReplay] Downsampled drivers:", posMap.size, "| track points:", track.length);

          const maxT = Math.max(...[...posMap.values()].map(pts => pts[pts.length - 1]?.t || 0));
          posDataRef.current   = posMap;
          activeNumsRef.current = [...posMap.keys()];
          totalDurRef.current  = maxT;

          setTrackBounds(bounds);
          boundsRef.current = bounds;
          setTrackPts(track);
          trackPtsRef.current = track;
          setTotalDur(maxT);
        } else {
          console.warn("[RaceReplay] Still < 100 GPS points after fallback — canvas map disabled.");
          setHasGPS(false);
        }

        setLoadPct(55);

        // ── Step: race positions (P1/P2 standings) ────────────────────────
        const posR = await fetch(`${OF1}/position?session_key=${sk}`);
        const posD = await posR.json();
        console.log("[RaceReplay] OpenF1 /position response:", Array.isArray(posD) ? `${posD.length} records` : posD);
        if (deadRef.current) return;

        // ── Step: laps ────────────────────────────────────────────────────
        setLoadStep(STEPS[3]); setLoadPct(65);
        const lapR = await fetch(`${OF1}/laps?session_key=${sk}`);
        const lapD = await lapR.json();
        console.log("[RaceReplay] OpenF1 /laps response:", Array.isArray(lapD) ? `${lapD.length} lap records` : lapD);
        if (deadRef.current) return;
        if (!Array.isArray(lapD) || lapD.length === 0) {
          console.warn("[RaceReplay] No lap data returned.");
        }
        setAllLaps(Array.isArray(lapD) ? lapD : []);

        // ── Step: stints ─────────────────────────────────────────────────
        setLoadStep(STEPS[4]); setLoadPct(80);
        const stR = await fetch(`${OF1}/stints?session_key=${sk}`);
        const stD = await stR.json();
        console.log("[RaceReplay] OpenF1 /stints response:", stD);
        if (deadRef.current) return;
        const stMap = {};
        (Array.isArray(stD) ? stD : []).forEach(s => {
          const k = String(s.driver_number);
          if (!stMap[k] || s.stint_number > stMap[k].stint_number) stMap[k] = s;
        });
        setStints(stMap);

        // ── Step: Ergast results (official finishing order) ───────────────
        const ergR = await fetch(`${ERGAST}/2026/${round}/results.json`).then(r => r.json());
        console.log("[RaceReplay] Ergast results:", ergR?.MRData?.RaceTable?.Races?.[0]?.Results?.length, "drivers");
        if (deadRef.current) return;
        setErgResults(ergR?.MRData?.RaceTable?.Races?.[0]?.Results || []);

        // ── Done ─────────────────────────────────────────────────────────
        setLoadStep(STEPS[5]); setLoadPct(95);
        await new Promise(r => setTimeout(r, 200));
        if (deadRef.current) return;
        setLoadPct(100);
        setLoadStep(null);
        setDataReady(true);

      } catch (err) {
        if (deadRef.current) return;
        console.error("[RaceReplay] Data load error:", err);
        setError(`Failed to load replay data: ${err.message}`);
        setLoadStep(null);
      }
    })();

    return () => { deadRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRace?.round, of1Sessions.length]);

  // ── Scrub handler ────────────────────────────────────────────────────────
  const handleScrub = useCallback((val) => {
    const t = Number(val);
    currentTRef.current = t;
    lastTsRef.current = null;
    setCurrentT(t);
    setIsPlaying(false);
    isPlayingRef.current = false;
  }, []);

  // ── Replay leaderboard (updated whenever currentT changes) ───────────────
  const replayLeaderboard = useMemo(() => {
    if (!allLaps.length) return [];
    const byDriver = {};
    for (const l of allLaps) {
      const k = String(l.driver_number);
      if (!byDriver[k]) byDriver[k] = [];
      byDriver[k].push(l);
    }
    const entries = Object.entries(byDriver).map(([num, laps]) => {
      const done  = laps.filter(l => l.lap_duration != null && l.lap_number != null);
      const cumT  = done.reduce((s, l) => s + (l.lap_duration || 0), 0);
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
  }, [allLaps, driverMap, stints]);

  const progressPct = totalDur > 0 ? (currentT / totalDur) * 100 : 0;
  const fmtTime = s => {
    if (!s || s < 0) return "0:00";
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}` : `${m}:${String(sec).padStart(2,"0")}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (initLoading) return (
    <div style={{ textAlign:"center", padding:"5rem", color:"#444", fontFamily:"monospace", fontSize:"0.8rem" }}>
      Loading schedule...
    </div>
  );
  if (allRaces.length === 0) return (
    <div style={{ textAlign:"center", padding:"5rem", color:"#444", fontFamily:"monospace", fontSize:"0.8rem" }}>
      No completed 2026 races yet.
    </div>
  );

  const isLoading = loadStep !== null;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {/* Race selector */}
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
                  padding: "0.35rem 0.65rem", borderRadius: 6, cursor: isLoading ? "not-allowed" : "pointer",
                  fontSize: "0.72rem", whiteSpace: "nowrap", fontFamily: "inherit",
                  opacity: isLoading && !active ? 0.5 : 1,
                }}>
                {flag} {race.raceName.replace(" Grand Prix", "")}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Loading progress */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              background: "rgba(8,8,16,0.9)", border: `1px solid rgba(225,6,0,0.25)`,
              borderRadius: 10, padding: "1.25rem 1.5rem", marginBottom: "1.5rem",
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: accent, letterSpacing: "0.12em" }}>
                {loadStep}
              </span>
              <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "#555" }}>{loadPct}%</span>
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
              <motion.div
                animate={{ width: `${loadPct}%` }}
                transition={{ duration: 0.4 }}
                style={{ height: "100%", background: `linear-gradient(90deg, ${accent}, #ff6b35)`, borderRadius: 99 }}
              />
            </div>
            {/* Step indicators */}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
              {STEPS.slice(0, -1).map((s, i) => {
                const stepPct = (i + 1) * (100 / (STEPS.length - 1));
                const done = loadPct >= stepPct;
                const active = loadStep === s;
                return (
                  <span key={i} style={{
                    fontSize: "0.58rem", fontFamily: "monospace",
                    color: done ? "#00e472" : active ? accent : "#333",
                    transition: "color 0.3s",
                  }}>
                    {done ? "✓" : active ? "○" : "·"} {s.replace("...", "").replace(" (this may take 30s)", "")}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(225,6,0,0.08)", border: `1px solid ${accent}44`, borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.8rem", color: "#f0a0a0" }}>⚠ {error}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedRace && !isLoading && (
        <div style={{ color: "#333", textAlign: "center", padding: "3rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
          Select a race above to load replay data.
        </div>
      )}

      {dataReady && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", alignItems: "start" }}>
          {/* Left: canvas + controls */}
          <div>
            {/* Canvas map */}
            <div style={{
              background: "#080812",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12, padding: "0.5rem", marginBottom: "0.75rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}>
              <div style={{ position: "relative", width: "100%", aspectRatio: `${CW}/${CH}` }}>
                <canvas ref={bgCanvasRef} width={CW} height={CH}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 8 }} />
                <canvas ref={fgCanvasRef} width={CW} height={CH}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 8 }} />
                {!hasGPS && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ color: "#2a2a3a", fontSize: "0.8rem", fontFamily: "monospace" }}>No GPS data available for this session</div>
                    <div style={{ color: "#1a1a28", fontSize: "0.65rem", fontFamily: "monospace" }}>OpenF1 may not have location data for this race</div>
                  </div>
                )}
              </div>
              {/* Race progress bar */}
              <div style={{ marginTop: 6, height: 3, background: "rgba(255,255,255,0.04)", borderRadius: 99, overflow: "hidden" }}>
                <motion.div
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.1 }}
                  style={{ height: "100%", background: `linear-gradient(90deg, ${accent}, #ff6b35)`, borderRadius: 99 }}
                />
              </div>
            </div>

            {/* Playback controls */}
            <div style={{
              background: "rgba(10,10,20,0.9)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "1rem 1.25rem",
              backdropFilter: "blur(12px)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.85rem" }}>
                {/* Play/Pause */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    lastTsRef.current = null;
                    setIsPlaying(v => !v);
                  }}
                  style={{
                    width: 38, height: 38, borderRadius: "50%", border: "none",
                    background: isPlaying
                      ? "linear-gradient(135deg, #f5c518, #e8a800)"
                      : `linear-gradient(135deg, ${accent}, #ff6b35)`,
                    color: "#000", fontWeight: 700, fontSize: "1rem", cursor: "pointer", flexShrink: 0,
                  }}>
                  {isPlaying ? "⏸" : "▶"}
                </motion.button>

                {/* Reset */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleScrub(0)}
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#555", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 }}
                  title="Reset">↺</motion.button>

                <span style={{ fontSize: "0.78rem", fontFamily: "monospace", color: "#888" }}>
                  {fmtTime(currentT)}
                  <span style={{ color: "#333" }}> / </span>
                  {fmtTime(totalDur)}
                </span>

                {/* Speed buttons */}
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

              {/* Scrubber */}
              <input
                type="range" min={0} max={totalDur || 1} step={5}
                value={currentT}
                onChange={e => handleScrub(e.target.value)}
                style={{ width: "100%", marginBottom: "0.35rem" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.58rem", color: "#2a2a3a", fontFamily: "monospace" }}>
                <span>0:00</span>
                <span style={{ color: accent }}>{fmtTime(currentT)}</span>
                <span>{fmtTime(totalDur)}</span>
              </div>
            </div>
          </div>

          {/* Right: leaderboard */}
          <div>
            <SectionLabel>Leaderboard</SectionLabel>

            {/* Replay leaderboard from lap data */}
            {replayLeaderboard.length > 0 ? replayLeaderboard.map((d, i) => {
              const cColor  = COMP_COLOR[d.compound] || "#444";
              const posClr  = i === 0 ? accent : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#444";
              return (
                <div key={d.num || i} style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  background: i % 2 === 0 ? "rgba(14,14,26,0.8)" : "rgba(10,10,20,0.8)",
                  borderLeft: `3px solid ${d.teamColor}`,
                  marginBottom: 2, borderRadius: 6,
                  transition: "all 0.3s ease",
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
            }) : (
              /* Fall back to Ergast official results */
              ergResults.length > 0 ? (
                <>
                  <div style={{ fontSize: "0.62rem", color: "#333", fontFamily: "monospace", marginBottom: "0.5rem" }}>
                    Showing official race result (no lap-by-lap data available)
                  </div>
                  {ergResults.slice(0, 12).map((r, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.45rem 0.75rem",
                      background: i % 2 === 0 ? "rgba(14,14,26,0.8)" : "rgba(10,10,20,0.8)",
                      marginBottom: 2, borderRadius: 6,
                    }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", width: 20, flexShrink: 0, color: i < 3 ? [accent,"#C0C0C0","#CD7F32"][i] : "#333", fontWeight: 700 }}>{r.position}</span>
                      <span style={{ flex: 1, fontSize: "0.78rem" }}>{r.Driver.givenName} {r.Driver.familyName}</span>
                      <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "#555" }}>
                        {i === 0 ? (r.Time?.time || "—") : r.Time?.time ? `+${r.Time.time}` : r.status}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ color: "#333", padding: "2rem", textAlign: "center", fontSize: "0.78rem" }}>
                  No lap data available — scrub the timeline to start replay.
                </div>
              )
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
