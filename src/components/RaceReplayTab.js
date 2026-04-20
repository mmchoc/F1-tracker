import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { SectionLabel, LoadingSpinner } from "./ui";
import { ERGAST, OF1, COUNTRY_FLAGS, COMP_COLOR, theme, formatLap } from "../constants";

const { accent, border } = theme;

// Canvas dimensions
const CW = 900, CH = 500, PAD = 28;

// ── Downsample: keep 1 sample per INTERVAL_S seconds per driver ───────────────
const INTERVAL_S = 10;

function downsample(rawLocs) {
  // rawLocs: [{driver_number, x, y, date}, ...]
  // Returns: Map<driverNum, [{t: seconds_from_session_start, x, y}]>
  if (!rawLocs.length) return new Map();
  const sessionStart = new Date(rawLocs[0].date).getTime();
  const byDriver = new Map();
  rawLocs.forEach(loc => {
    const k = String(loc.driver_number);
    if (!byDriver.has(k)) byDriver.set(k, []);
    byDriver.get(k).push({ t: (new Date(loc.date).getTime() - sessionStart) / 1000, x: loc.x, y: loc.y });
  });
  const result = new Map();
  byDriver.forEach((pts, num) => {
    pts.sort((a, b) => a.t - b.t);
    const sampled = [];
    let lastT = -Infinity;
    pts.forEach(p => {
      if (p.t - lastT >= INTERVAL_S) {
        sampled.push(p);
        lastT = p.t;
      }
    });
    if (sampled.length) result.set(num, sampled);
  });
  return result;
}

function normalizePt(raw, bounds) {
  if (!bounds) return null;
  const x = PAD + ((raw.x - bounds.minX) / bounds.w) * (CW - PAD * 2);
  const y = PAD + (1 - (raw.y - bounds.minY) / bounds.h) * (CH - PAD * 2);
  if (!isFinite(x) || !isFinite(y)) return null;
  return { x, y };
}

function getInterpolatedPos(samples, t) {
  if (!samples || samples.length === 0) return null;
  if (t <= samples[0].t) return samples[0];
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1];
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  const alpha = (t - a.t) / (b.t - a.t);
  return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
}

function drawTrack(ctx, trackPts, bounds) {
  ctx.clearRect(0, 0, CW, CH);
  if (!trackPts.length || !bounds) return;
  ctx.save();
  ctx.strokeStyle = "#1e1e30";
  ctx.lineWidth = 16;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  trackPts.forEach((raw, i) => {
    const pt = normalizePt(raw, bounds);
    if (!pt) return;
    if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = "#3c3c58";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawFrame(ctx, posData, driverMap, bounds, currentT, activeNums) {
  ctx.clearRect(0, 0, CW, CH);
  if (!bounds) return;

  activeNums.forEach(num => {
    const samples = posData.get(num);
    if (!samples) return;
    const raw = getInterpolatedPos(samples, currentT);
    if (!raw) return;
    const pt = normalizePt(raw, bounds);
    if (!pt) return;

    const drv = driverMap[num] || {};
    const col = drv.team_colour ? `#${drv.team_colour}` : "#888";
    const code = drv.name_acronym || num;

    ctx.save();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = col;
    ctx.fillText(code, pt.x, pt.y - 10);
    ctx.restore();
  });
}

// ── Remotion-based video export component ─────────────────────────────────────
let RemotionPlayer = null;
try {
  const remotion = require("@remotion/player");
  RemotionPlayer = remotion.Player;
} catch (_) {}

function ReplayVideoComposition({ posData, driverMap, bounds, trackPts, totalDuration, driverNums }) {
  const bgCanvasRef = useRef(null);
  const fgCanvasRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas || initializedRef.current) return;
    const ctx = canvas.getContext("2d");
    drawTrack(ctx, trackPts, bounds);
    initializedRef.current = true;
  }, [bounds, trackPts]);

  // For Remotion we need to use useCurrentFrame/continueRender but we only have
  // basic player without full Remotion context here — use currentTime prop instead
  return (
    <div style={{ position: "relative", width: CW, height: CH, background: "#0a0a0f" }}>
      <canvas ref={bgCanvasRef} width={CW} height={CH} style={{ position: "absolute", inset: 0 }} />
      <canvas ref={fgCanvasRef} width={CW} height={CH} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RaceReplayTab() {
  const [allRaces,     setAllRaces]     = useState([]);
  const [of1Sessions,  setOf1Sessions]  = useState([]);
  const [selectedRace, setSelectedRace] = useState(null);
  const [sessionData,  setSessionData]  = useState(null);
  const [loadingInit,  setLoadingInit]  = useState(true);
  const [loadingData,  setLoadingData]  = useState(false);
  const [loadPct,      setLoadPct]      = useState(0);

  const [of1Drivers,   setOf1Drivers]   = useState({});
  const [stints,       setStints]       = useState({});
  const [allLapsRaw,   setAllLapsRaw]   = useState([]);
  const [ergastResults, setErgastResults] = useState([]);

  // Position data (downsampled), stored as Map in a ref to avoid re-renders
  const posDataRef    = useRef(new Map()); // Map<driverNum, [{t,x,y}]>
  const [posDataReady, setPosDataReady] = useState(false);
  const totalDurRef   = useRef(0);

  // Track
  const [trackPts,    setTrackPts]    = useState([]);
  const [trackBounds, setTrackBounds] = useState(null);

  // Replay playback state
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [playSpeed,   setPlaySpeed]   = useState(1);
  const [currentT,    setCurrentT]    = useState(0);         // seconds from session start
  const [totalDur,    setTotalDur]    = useState(0);

  // Replay leaderboard (updated every 500ms from a setInterval)
  // eslint-disable-next-line no-unused-vars
  const [replayBoard, setReplayBoard] = useState([]);

  // RAF refs
  const bgCanvasRef   = useRef(null);
  const fgCanvasRef   = useRef(null);
  const rafRef        = useRef(null);
  const currentTRef   = useRef(0);
  const isPlayingRef  = useRef(false);
  const playSpeedRef  = useRef(1);
  const lastTsRef     = useRef(null);
  const drvMapRef     = useRef({});
  const boundsRef     = useRef(null);
  const trackPtsRef   = useRef([]);
  const activeNumsRef = useRef([]);

  // Sync refs
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { playSpeedRef.current = playSpeed; }, [playSpeed]);
  useEffect(() => { drvMapRef.current = of1Drivers; }, [of1Drivers]);
  useEffect(() => { boundsRef.current = trackBounds; }, [trackBounds]);
  useEffect(() => { trackPtsRef.current = trackPts; }, [trackPts]);

  // Draw track on bg canvas when it changes
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas || !trackPts.length || !trackBounds) return;
    const ctx = canvas.getContext("2d");
    drawTrack(ctx, trackPts, trackBounds);
  }, [trackPts, trackBounds]);

  // Main RAF loop — no state updates, pure canvas draws
  useEffect(() => {
    let cancelled = false;
    const tick = (ts) => {
      if (cancelled) return;
      const canvas = fgCanvasRef.current;
      if (canvas && boundsRef.current && posDataRef.current.size > 0) {
        if (isPlayingRef.current && lastTsRef.current !== null) {
          const dt = (ts - lastTsRef.current) / 1000;
          currentTRef.current = Math.min(currentTRef.current + dt * playSpeedRef.current, totalDurRef.current);
          if (currentTRef.current >= totalDurRef.current) {
            isPlayingRef.current = false;
            setIsPlaying(false);
          }
        }
        lastTsRef.current = ts;
        const ctx = canvas.getContext("2d");
        drawFrame(ctx, posDataRef.current, drvMapRef.current, boundsRef.current, currentTRef.current, activeNumsRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Sync currentT slider ↔ ref (slider updates ref, ref drives RAF)
  const handleScrub = useCallback((val) => {
    const t = Number(val);
    currentTRef.current = t;
    lastTsRef.current = null; // reset delta so no jump
    setCurrentT(t);
    setIsPlaying(false);
    isPlayingRef.current = false;
  }, []);

  // Leaderboard sync: poll currentTRef every 500ms to build replay leaderboard
  useEffect(() => {
    if (!posDataReady || !allLapsRaw.length) return;
    const id = setInterval(() => {
      setCurrentT(currentTRef.current);
    }, 200);
    return () => clearInterval(id);
  }, [posDataReady, allLapsRaw.length]);

  // Effect 1: load schedule
  useEffect(() => {
    let dead = false;
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      fetch(`${ERGAST}/2026.json`).then(r => r.json()),
      fetch(`${OF1}/sessions?year=2026&session_name=Race`).then(r => r.json()),
    ]).then(([erg, of1]) => {
      if (dead) return;
      const races = (erg?.MRData?.RaceTable?.Races || []).filter(r => r.date <= today);
      const sessions = Array.isArray(of1) ? of1 : [];
      setAllRaces(races);
      setOf1Sessions(sessions);
      if (races.length > 0) setSelectedRace(races[races.length - 1]);
      setLoadingInit(false);
    }).catch(() => setLoadingInit(false));
    return () => { dead = true; };
  }, []);

  // Effect 2: match race → session
  useEffect(() => {
    if (!selectedRace || !of1Sessions.length) return;
    const locality = selectedRace.Circuit.Location.locality.toLowerCase();
    const country  = selectedRace.Circuit.Location.country.toLowerCase();
    const match = of1Sessions.find(s => s.location?.toLowerCase() === locality)
               || of1Sessions.find(s => s.country_name?.toLowerCase() === country);
    if (!match) return;
    setSessionData(match);
    // Reset
    setOf1Drivers({}); setStints({}); setAllLapsRaw([]); setErgastResults([]);
    setTrackPts([]); setTrackBounds(null);
    posDataRef.current = new Map();
    setPosDataReady(false);
    setIsPlaying(false); isPlayingRef.current = false;
    setCurrentT(0); currentTRef.current = 0;
    setTotalDur(0); totalDurRef.current = 0;
    setReplayBoard([]);
    setLoadPct(0);
  }, [selectedRace, of1Sessions]);

  // Effect 3: load ALL race data upfront
  useEffect(() => {
    if (!sessionData || !selectedRace) return;
    let dead = false;
    setLoadingData(true);
    setLoadPct(0);
    const sk = sessionData.session_key;
    const round = selectedRace.round;

    (async () => {
      try {
        // Step 1: parallel fetch of metadata (20%)
        setLoadPct(5);
        const [ergR, drvR, stR, lapR] = await Promise.all([
          fetch(`${ERGAST}/2026/${round}/results.json`).then(r => r.json()),
          fetch(`${OF1}/drivers?session_key=${sk}`).then(r => r.json()),
          fetch(`${OF1}/stints?session_key=${sk}`).then(r => r.json()),
          fetch(`${OF1}/laps?session_key=${sk}`).then(r => r.json()),
        ]);
        if (dead) return;
        setLoadPct(20);

        setErgastResults(ergR?.MRData?.RaceTable?.Races?.[0]?.Results || []);

        const drvsArr = Array.isArray(drvR) ? drvR : [];
        const drvsMap = {};
        drvsArr.forEach(d => { drvsMap[String(d.driver_number)] = d; });
        setOf1Drivers(drvsMap);
        drvMapRef.current = drvsMap;

        const stMap = {};
        (Array.isArray(stR) ? stR : []).forEach(s => {
          const k = String(s.driver_number);
          if (!stMap[k] || s.stint_number > stMap[k].stint_number) stMap[k] = s;
        });
        setStints(stMap);
        setAllLapsRaw(Array.isArray(lapR) ? lapR : []);

        // Step 2: Track outline (40%)
        if (drvsArr.length > 0 && !dead) {
          const t0    = new Date(sessionData.date_start);
          const tFrom = new Date(t0.getTime() - 5 * 60000).toISOString();
          const tTo   = new Date(t0.getTime() + 40 * 60000).toISOString();
          const results = await Promise.allSettled(
            drvsArr.slice(0, 4).map(d =>
              fetch(`${OF1}/location?session_key=${sk}&driver_number=${d.driver_number}&date>${tFrom}&date<${tTo}`)
                .then(r => r.json())
            )
          );
          if (!dead) {
            for (const res of results) {
              if (res.status !== "fulfilled") continue;
              const locD = res.value;
              if (!Array.isArray(locD) || locD.length < 30) continue;
              const pts = locD.filter((_, i) => i % 3 === 0);
              const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
              const minX = Math.min(...xs), maxX = Math.max(...xs);
              const minY = Math.min(...ys), maxY = Math.max(...ys);
              const bounds = { minX, w: maxX - minX || 1, minY, h: maxY - minY || 1 };
              setTrackBounds(bounds);
              boundsRef.current = bounds;
              setTrackPts(pts);
              trackPtsRef.current = pts;
              break;
            }
          }
        }
        setLoadPct(40);

        // Step 3: Fetch ALL location data for the session in batches by driver (40%→100%)
        if (drvsArr.length > 0 && !dead && sessionData.date_start && sessionData.date_end) {
          const tFrom = sessionData.date_start;
          const tTo   = sessionData.date_end;
          const allLocs = [];
          const BATCH_SIZE = 5;
          const total = drvsArr.length;
          let done = 0;

          for (let i = 0; i < total && !dead; i += BATCH_SIZE) {
            const batch = drvsArr.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
              batch.map(d =>
                fetch(`${OF1}/location?session_key=${sk}&driver_number=${d.driver_number}&date>${tFrom}&date<${tTo}`)
                  .then(r => r.json())
              )
            );
            results.forEach(res => {
              if (res.status === "fulfilled" && Array.isArray(res.value)) {
                allLocs.push(...res.value);
              }
            });
            done += batch.length;
            setLoadPct(40 + Math.round((done / total) * 58));
          }

          if (!dead && allLocs.length > 0) {
            const downsampled = downsample(allLocs);
            posDataRef.current = downsampled;
            activeNumsRef.current = [...downsampled.keys()];

            // Compute total duration from session times
            const sessionStart = new Date(sessionData.date_start).getTime();
            const sessionEnd   = new Date(sessionData.date_end).getTime();
            const dur = (sessionEnd - sessionStart) / 1000;
            totalDurRef.current = dur;
            setTotalDur(dur);
            setPosDataReady(true);
          }
        }
        setLoadPct(100);
      } catch (_) {}
      if (!dead) setLoadingData(false);
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.session_key]);

  // Replay leaderboard: sorted by cumulative time at currentT
  const replayLeaderboard = useMemo(() => {
    if (!allLapsRaw.length || !sessionData?.date_start) return [];
    const sessionStart = new Date(sessionData.date_start).getTime();

    const byDriver = {};
    allLapsRaw.forEach(l => {
      const k = String(l.driver_number);
      if (!byDriver[k]) byDriver[k] = [];
      byDriver[k].push(l);
    });

    const entries = Object.entries(byDriver).map(([num, laps]) => {
      const currentTabs = sessionStart / 1000 + currentT;
      const done = laps.filter(l => {
        if (!l.date_start || !l.lap_duration) return false;
        const lapEnd = new Date(l.date_start).getTime() / 1000 + l.lap_duration;
        return lapEnd <= currentTabs;
      });
      const lapsCompleted = done.reduce((m, l) => Math.max(m, l.lap_number || 0), 0);
      const cumTime = done.reduce((s, l) => s + (l.lap_duration || 0), 0);
      const lastLapObj = done.find(l => l.lap_number === lapsCompleted);
      const drv = of1Drivers[num] || {};
      const stint = stints[num];
      return {
        num, code: drv.name_acronym || `#${num}`,
        fullName: drv.full_name || "",
        teamColor: drv.team_colour ? `#${drv.team_colour}` : "#888",
        lapsCompleted, cumTime,
        lastLap: lastLapObj?.lap_duration,
        compound: stint?.compound || "",
      };
    }).filter(d => d.lapsCompleted > 0)
      .sort((a, b) => b.lapsCompleted - a.lapsCompleted || a.cumTime - b.cumTime);

    const leaderCum  = entries[0]?.cumTime || 0;
    const leaderLaps = entries[0]?.lapsCompleted || 0;
    return entries.map((d, i) => ({
      ...d,
      position: i + 1,
      gap: i === 0
        ? formatLap(d.cumTime)
        : d.lapsCompleted < leaderLaps
          ? `+${leaderLaps - d.lapsCompleted}L`
          : `+${(d.cumTime - leaderCum).toFixed(3)}s`,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentT, allLapsRaw, of1Drivers, stints, sessionData?.date_start]);

  // Progress %
  const progressPct = totalDur > 0 ? (currentT / totalDur) * 100 : 0;

  if (loadingInit) return <LoadingSpinner label="Loading schedule..." />;
  if (allRaces.length === 0) return (
    <div style={{ textAlign: "center", padding: "5rem", color: "#444", fontFamily: "monospace", fontSize: "0.8rem" }}>
      No completed 2026 races yet.
    </div>
  );

  const formatTime = (s) => {
    if (!s || s <= 0) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
      : `${m}:${String(sec).padStart(2,"0")}`;
  };

  return (
    <div className="fade-in">
      {/* Race selector */}
      <div style={{ marginBottom: "1.5rem" }}>
        <SectionLabel>Select Race</SectionLabel>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {allRaces.map(race => {
            const active = selectedRace?.round === race.round;
            const flag = COUNTRY_FLAGS[race.Circuit.Location.country] || "🏁";
            return (
              <button key={race.round} onClick={() => setSelectedRace(race)} style={{
                background: active ? "#1e1e2e" : "transparent",
                border: `1px solid ${active ? accent : "#1f1f2e"}`,
                color: active ? "#fff" : "#555",
                padding: "0.35rem 0.65rem", borderRadius: 6, cursor: "pointer",
                fontSize: "0.72rem", transition: "all 0.15s", whiteSpace: "nowrap",
                fontFamily: "inherit",
              }}>
                {flag} {race.raceName.replace(" Grand Prix", "")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading bar */}
      {loadingData && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: accent, fontFamily: "monospace", marginBottom: 4 }}>
            <span>LOADING RACE DATA</span>
            <span>{loadPct}%</span>
          </div>
          <div style={{ height: 4, background: "#1a1a28", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${loadPct}%`, background: `linear-gradient(90deg, ${accent}, #ff6b6b)`, borderRadius: 2, transition: "width 0.3s ease" }} />
          </div>
          <div style={{ fontSize: "0.6rem", color: "#444", marginTop: 4, fontFamily: "monospace" }}>
            {loadPct < 20 ? "Fetching results & lap data..." : loadPct < 40 ? "Building track outline..." : `Fetching GPS position data... ${loadPct}%`}
          </div>
        </div>
      )}

      {!sessionData && !loadingData && (
        <div style={{ color: "#444", textAlign: "center", padding: "3rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
          Select a race above to load replay data.
        </div>
      )}

      {sessionData && !loadingData && (
        <>
          {/* Session info */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.1em", fontFamily: "monospace", color: "#888" }}>
              REPLAY
            </span>
            <span style={{ color: "#888", fontSize: "0.82rem" }}>
              {selectedRace?.raceName} — {sessionData.circuit_short_name}
            </span>
            {posDataReady && (
              <span style={{ fontSize: "0.68rem", color: "#444", fontFamily: "monospace" }}>
                {posDataRef.current.size} drivers · {Math.round(totalDur / 60)}min session
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", alignItems: "start" }}>
            {/* Canvas map + controls */}
            <div>
              {/* Canvas */}
              <div style={{ background: "#0d0d16", border: `1px solid ${border}`, borderRadius: 12, padding: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ position: "relative", width: "100%", aspectRatio: `${CW}/${CH}` }}>
                  <canvas ref={bgCanvasRef} width={CW} height={CH}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: 8 }} />
                  <canvas ref={fgCanvasRef} width={CW} height={CH}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: 8 }} />
                  {!trackPts.length && !loadingData && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: "0.75rem", fontFamily: "monospace" }}>
                      No GPS data available
                    </div>
                  )}
                  {!posDataReady && sessionData && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ color: "#444", fontSize: "0.75rem", fontFamily: "monospace", textAlign: "center" }}>
                        {loadingData ? "Loading position data..." : "No position data available"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Race progress bar */}
                <div style={{ marginTop: 6, height: 3, background: "#1a1a28", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progressPct}%`, background: `linear-gradient(90deg, ${accent}, #ff4444)`, borderRadius: 2 }} />
                </div>
              </div>

              {/* Playback controls */}
              {posDataReady && (
                <div style={{ background: "#0e0e17", border: `1px solid ${border}`, borderRadius: 10, padding: "0.85rem 1rem" }}>
                  {/* Play/pause + speed */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                    <button onClick={() => {
                      lastTsRef.current = null;
                      setIsPlaying(v => !v);
                    }} style={{
                      background: isPlaying ? "#f5c518" : accent,
                      border: "none", color: "#000", fontWeight: 700,
                      width: 36, height: 36, borderRadius: "50%",
                      cursor: "pointer", fontSize: "1rem", lineHeight: 1, flexShrink: 0,
                    }}>
                      {isPlaying ? "⏸" : "▶"}
                    </button>

                    <button onClick={() => {
                      handleScrub(0);
                    }} style={{
                      background: "transparent", border: `1px solid ${border}`,
                      color: "#555", width: 30, height: 30, borderRadius: "50%",
                      cursor: "pointer", fontSize: "0.8rem", lineHeight: 1, flexShrink: 0,
                    }} title="Reset">↺</button>

                    <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#888", marginLeft: "0.25rem" }}>
                      {formatTime(currentT)} / {formatTime(totalDur)}
                    </span>

                    <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                      {[1, 2, 4].map(s => (
                        <button key={s} onClick={() => setPlaySpeed(s)} style={{
                          background: playSpeed === s ? "#1e1e2e" : "transparent",
                          border: `1px solid ${playSpeed === s ? accent : border}`,
                          color: playSpeed === s ? accent : "#555",
                          padding: "0.25rem 0.5rem", borderRadius: 4, cursor: "pointer",
                          fontSize: "0.65rem", fontFamily: "monospace", fontWeight: 600,
                        }}>{s}×</button>
                      ))}
                    </div>
                  </div>

                  {/* Time scrubber */}
                  <input
                    type="range" min={0} max={totalDur} step={1} value={currentT}
                    onChange={e => handleScrub(e.target.value)}
                    style={{ width: "100%", marginBottom: "0.3rem" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.58rem", color: "#3a3a4a", fontFamily: "monospace" }}>
                    <span>0:00</span>
                    <span style={{ color: accent }}>{formatTime(currentT)}</span>
                    <span>{formatTime(totalDur)}</span>
                  </div>
                </div>
              )}

              {/* Remotion export */}
              {posDataReady && RemotionPlayer && (
                <div style={{ marginTop: "0.75rem", background: "#0e0e17", border: `1px solid ${border}`, borderRadius: 10, padding: "0.85rem 1rem" }}>
                  <SectionLabel style={{ marginBottom: "0.5rem" }}>Export Replay Video</SectionLabel>
                  <div style={{ fontSize: "0.72rem", color: "#666", marginBottom: "0.75rem" }}>
                    Preview the replay in the embedded player and export as MP4.
                  </div>
                  <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${border}` }}>
                    <RemotionPlayer
                      component={ReplayVideoComposition}
                      inputProps={{ posData: posDataRef.current, driverMap: of1Drivers, bounds: trackBounds, trackPts, totalDuration: totalDur, driverNums: activeNumsRef.current }}
                      durationInFrames={Math.max(1, Math.round(totalDur * 30))}
                      compositionWidth={CW}
                      compositionHeight={CH}
                      fps={30}
                      style={{ width: "100%" }}
                      controls
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Replay leaderboard */}
            <div>
              <SectionLabel>
                Leaderboard
                {posDataReady && (
                  <span style={{ marginLeft: "0.5rem", color: "#444", fontWeight: 400 }}>
                    @ {formatTime(currentT)}
                  </span>
                )}
              </SectionLabel>

              {replayLeaderboard.length === 0 && (
                <div style={{ color: "#333", padding: "2rem", textAlign: "center", fontSize: "0.78rem" }}>
                  {posDataReady ? "Scrub or press play to begin replay." : "No lap data for this race."}
                </div>
              )}

              {replayLeaderboard.map((d, i) => {
                const cColor = COMP_COLOR[d.compound] || "#555";
                const posColor = i === 0 ? accent : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#555";
                return (
                  <div key={d.num || i} style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.5rem 0.7rem",
                    background: i % 2 === 0 ? "#12121a" : "#0e0e17",
                    borderLeft: `3px solid ${d.teamColor}`,
                    marginBottom: 2, borderRadius: 4,
                    transition: "all 0.3s ease",
                  }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.8rem", width: 20, flexShrink: 0, color: posColor, fontWeight: 700 }}>
                      {d.position}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.8rem", color: d.teamColor }}>{d.code}</span>
                        <span style={{ fontSize: "0.65rem", color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                          {d.fullName}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.58rem", color: "#444", fontFamily: "monospace" }}>L{d.lapsCompleted}</span>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "0.68rem", fontFamily: "monospace", color: i === 0 ? "#00e472" : "#666" }}>{d.gap}</div>
                      <div style={{ fontSize: "0.64rem", fontFamily: "monospace", color: "#555" }}>{formatLap(d.lastLap)}</div>
                    </div>
                    {d.compound && (
                      <div style={{ fontSize: "0.6rem", fontWeight: 700, color: cColor, background: `${cColor}18`, border: `1px solid ${cColor}50`, borderRadius: 4, padding: "0.1rem 0.2rem", flexShrink: 0 }}>
                        {d.compound[0]}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Results (static) */}
              {ergastResults.length > 0 && replayLeaderboard.length === 0 && (
                <div style={{ marginTop: "1rem" }}>
                  <SectionLabel style={{ marginBottom: "0.5rem" }}>Official Race Result</SectionLabel>
                  {ergastResults.slice(0, 10).map((r, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.4rem 0.7rem",
                      background: i % 2 === 0 ? "#12121a" : "#0e0e17",
                      marginBottom: 2, borderRadius: 4,
                    }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", width: 20, flexShrink: 0, color: i < 3 ? [accent,"#C0C0C0","#CD7F32"][i] : "#444", fontWeight: 700 }}>
                        {r.position}
                      </span>
                      <span style={{ flex: 1, fontSize: "0.78rem" }}>{r.Driver.givenName} {r.Driver.familyName}</span>
                      <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "#666" }}>
                        {i === 0 ? (r.Time?.time || "—") : r.Time?.time ? `+${r.Time.time}` : r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
