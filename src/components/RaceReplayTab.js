import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionLabel, pageVariants } from "./ui";
import { ERGAST, OF1, COUNTRY_FLAGS, COMP_COLOR, theme, formatLap } from "../constants";

const { accent } = theme;
const CW = 900, CH = 480;               // canvas resolution
const LOOKUP_N   = 1000;                 // evenly-spaced track-following points
// 1× = 30 race-sec/real-sec  →  90s lap takes 3s of replay, 90-min race ≈ 3 min
const BASE_SPEED = 30;
const SUB_LAPS   = 10;                   // position samples per lap

// ── GeoJSON circuit source ────────────────────────────────────────────────────
const GEOJSON_BASE = "https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits";

const CIRCUIT_FILES = {
  albert_park:   "au-1953", shanghai:    "cn-2004", suzuka:      "jp-1962",
  bahrain:       "bh-2002", jeddah:      "sa-2021", monaco:      "mc-1929",
  villeneuve:    "ca-1978", catalunya:   "es-2026", red_bull_ring:"at-1969",
  silverstone:   "gb-1948", hungaroring: "hu-1986", spa:         "be-1925",
  zandvoort:     "nl-1948", monza:       "it-1953", baku:        "az-2016",
  marina_bay:    "sg-2008", americas:    "us-2012", rodriguez:   "mx-1962",
  interlagos:    "br-1977", vegas:       "us-2023", losail:      "qa-2004",
  yas_marina:    "ae-2009",
};

// ── Pure coordinate helpers ───────────────────────────────────────────────────

async function fetchCircuitPoints(ergastId) {
  const fileId = CIRCUIT_FILES[ergastId];
  if (!fileId) return [];
  try {
    const res = await fetch(`${GEOJSON_BASE}/${fileId}.geojson`);
    if (!res.ok) return [];
    const geo    = await res.json();
    const coords = geo?.features?.[0]?.geometry?.coordinates;
    return Array.isArray(coords) ? normalizeGeoCoords(coords) : [];
  } catch { return []; }
}

// Fit [lon, lat] pairs into CW×CH, preserving aspect ratio, north-up.
function normalizeGeoCoords(coords, W = CW, H = CH, pad = 50) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
  }
  const rLon = maxLon - minLon || 1, rLat = maxLat - minLat || 1;
  const scale = Math.min((W - pad * 2) / rLon, (H - pad * 2) / rLat);
  const ox = (W - rLon * scale) / 2, oy = (H - rLat * scale) / 2;
  return coords.map(([lon, lat]) => ({
    x: ox + (lon - minLon) * scale,
    y: H - (oy + (lat - minLat) * scale),  // flip Y: north → top
  }));
}

// Cumulative distances along pts[], plus closing segment.
function buildCumDists(pts) {
  if (pts.length < 2) return { cumDists: [0], total: 0 };
  const c = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
    c.push(c[i-1] + Math.sqrt(dx*dx + dy*dy));
  }
  const dx = pts[0].x - pts[pts.length-1].x, dy = pts[0].y - pts[pts.length-1].y;
  return { cumDists: c, total: c[c.length-1] + Math.sqrt(dx*dx + dy*dy) };
}

// Interpolate a point along the closed circuit at progress ∈ [0, 1).
function getPointAtProgress(pts, cumDists, total, p) {
  if (!pts.length || !total) return { x: CW/2, y: CH/2 };
  const target  = ((p % 1) + 1) % 1 * total;
  const maxDist = cumDists[cumDists.length - 1];
  if (target >= maxDist) {
    const seg   = total - maxDist;
    const alpha = seg > 0 ? (target - maxDist) / seg : 0;
    const a = pts[pts.length-1], b = pts[0];
    return { x: a.x + (b.x-a.x)*alpha, y: a.y + (b.y-a.y)*alpha };
  }
  let lo = 0, hi = cumDists.length - 1;
  while (hi - lo > 1) { const mid = (lo+hi)>>1; if (cumDists[mid] <= target) lo=mid; else hi=mid; }
  const a = pts[lo], b = pts[hi], seg = cumDists[hi]-cumDists[lo];
  const alpha = seg > 0 ? (target - cumDists[lo]) / seg : 0;
  return { x: a.x + (b.x-a.x)*alpha, y: a.y + (b.y-a.y)*alpha };
}

// 1000 evenly-spaced points for sub-pixel-smooth track following.
function buildTrackLookup(pts) {
  if (!pts.length) return [];
  const { cumDists, total } = buildCumDists(pts);
  return Array.from({ length: LOOKUP_N }, (_, i) =>
    getPointAtProgress(pts, cumDists, total, i / LOOKUP_N)
  );
}

// Look up a canvas point from progress using the precomputed lookup table.
// Interpolates between adjacent entries for sub-pixel smoothness.
function lookupPoint(lookup, progress) {
  if (!lookup.length) return { x: CW/2, y: CH/2 };
  const norm = ((progress % 1) + 1) % 1;
  const raw  = norm * LOOKUP_N;
  const idx  = Math.floor(raw) % LOOKUP_N;
  const next = (idx + 1) % LOOKUP_N;
  const frac = raw - Math.floor(raw);
  const a = lookup[idx], b = lookup[next];
  return { x: a.x + (b.x-a.x)*frac, y: a.y + (b.y-a.y)*frac };
}

// ── Driver timeline helpers ───────────────────────────────────────────────────

// Build dense {t, progress} samples (SUB_LAPS per lap) using date_start timestamps.
// progress = laps completed as a real number (NOT divided by totalLaps) so that
// lookupPoint's (progress % 1) always gives the correct circuit position:
//   - end of lap 43 → progress=43 → 43%1=0 → S/F line  ✓
//   - mid lap 44    → progress=43.5 → 0.5 → halfway around circuit ✓
// Using date_start puts all drivers on a shared race-time axis so inter-driver
// spacing is accurate (a driver 5s behind appears 5/avgLapTime laps behind on track).
function buildDriverTimelines(allLaps, totalLaps, driverMap, stints) {
  const byDriver = {};
  for (const l of allLaps) {
    const k = String(l.driver_number);
    if (!byDriver[k]) byDriver[k] = [];
    byDriver[k].push(l);
  }

  // Shared race clock: earliest date_start for lap 1 across all drivers.
  const raceStartMs = allLaps
    .filter(l => l.lap_number === 1 && l.date_start)
    .reduce((mn, l) => Math.min(mn, Date.parse(l.date_start)), Infinity);
  const hasTimestamps = raceStartMs !== Infinity;

  const result     = {};
  const diag       = [];

  for (const [num, laps] of Object.entries(byDriver)) {
    const sorted = laps
      .filter(l => l.lap_number != null && l.lap_duration != null && l.lap_duration > 0)
      .sort((a, b) => a.lap_number - b.lap_number);
    if (!sorted.length) continue;

    const maxLap    = sorted[sorted.length - 1].lap_number;
    const isRetired = maxLap < totalLaps;
    const drv       = driverMap[num] || {};
    const code      = drv.name_acronym || `#${num}`;

    // Detect gaps in lap data (missing lap numbers).
    const lapNums = sorted.map(l => l.lap_number);
    const missing = [];
    for (let i = 1; i < lapNums.length; i++) {
      if (lapNums[i] - lapNums[i - 1] > 1)
        missing.push(`${lapNums[i-1]+1}–${lapNums[i]-1}`);
    }
    diag.push(
      `${code}: ${maxLap} laps` +
      (isRetired ? ` (retired lap ${maxLap})` : '') +
      (missing.length ? ` [gaps: ${missing.join(', ')}]` : '')
    );

    // Build samples in absolute race-time seconds.
    const samples    = [{ t: 0, progress: 0 }];
    let fallbackTime = 0; // used when date_start is absent

    for (const lap of sorted) {
      const lapN = lap.lap_number;
      let lapStartSec;

      if (hasTimestamps && lap.date_start) {
        lapStartSec  = (Date.parse(lap.date_start) - raceStartMs) / 1000;
        fallbackTime = lapStartSec;
      } else {
        lapStartSec = fallbackTime;
      }

      for (let sub = 1; sub <= SUB_LAPS; sub++) {
        const frac = sub / SUB_LAPS;
        samples.push({
          t:        lapStartSec + frac * lap.lap_duration,
          progress: lapN - 1 + frac,   // raw laps — lookupPoint uses % 1
        });
      }
      fallbackTime = lapStartSec + lap.lap_duration;
    }

    const stint = stints[num];
    result[num] = {
      num, code,
      color:      drv.team_colour ? `#${drv.team_colour}` : "#888",
      compound:   stint?.compound || "",
      samples,    maxTime: samples[samples.length - 1].t,
      isRetired,  retiredLap: isRetired ? maxLap : null,
    };
  }

  // Diagnostic summary — answers: how many laps, who retired, any gaps?
  console.log('[RaceReplay] Driver diagnostics (date_start timestamps: ' + hasTimestamps + '):\n' +
    diag.map(d => '  ' + d).join('\n'));

  return result;
}

// Interpolate a driver's track progress at race time t using smoothstep.
function getProgressAtTime(driver, t) {
  const { samples } = driver;
  if (!samples.length) return 0;
  if (t <= samples[0].t) return samples[0].progress;
  const last = samples[samples.length - 1];
  if (t >= last.t) return last.progress;
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) { const mid = (lo+hi)>>1; if (samples[mid].t <= t) lo=mid; else hi=mid; }
  const a = samples[lo], b = samples[hi];
  const alpha = (t - a.t) / (b.t - a.t);
  const smooth = alpha * alpha * (3 - 2 * alpha);  // smoothstep easing
  return a.progress + smooth * (b.progress - a.progress);
}

// ── Canvas drawing ────────────────────────────────────────────────────────────

// Pre-render track to offscreen canvas once — zero redraw cost per frame.
function drawTrackToOffscreen(offscreen, lookup) {
  const ctx = offscreen.getContext("2d");
  ctx.fillStyle = "#080812";
  ctx.fillRect(0, 0, CW, CH);
  if (!lookup.length) return;

  const buildPath = () => {
    const p = new Path2D();
    p.moveTo(lookup[0].x, lookup[0].y);
    for (let i = 1; i < lookup.length; i++) p.lineTo(lookup[i].x, lookup[i].y);
    p.closePath();
    return p;
  };

  const p = buildPath();
  ctx.lineJoin = "round"; ctx.lineCap = "round";

  const layers = [
    [22, "rgba(255,255,255,0.04)"],
    [15, "#1a1a2e"],
    [9,  "#222236"],
    [3,  "#2e2e50"],
  ];
  for (const [lw, style] of layers) {
    ctx.lineWidth   = lw;
    ctx.strokeStyle = style;
    ctx.stroke(p);
  }

  // Start/finish marker — small bright tick at progress=0
  const sf = lookup[0];
  const sf2 = lookup[3] || lookup[1];
  const ang = Math.atan2(sf2.y - sf.y, sf2.x - sf.x) + Math.PI / 2;
  ctx.save();
  ctx.translate(sf.x, sf.y);
  ctx.rotate(ang);
  ctx.strokeStyle = "#e10600";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
  ctx.restore();
}

// Draw one driver dot. isDNF = driver retired and current race time is past their last lap.
// DNF drivers are shown at the S/F line (progress=integer, % 1 = 0) grayed out.
function drawDriverDot(ctx, lookup, progress, color, code, isDNF = false) {
  if (!lookup.length) return;

  if (!isDNF) {
    // Motion-blur trail: two ghost dots behind
    const trailDefs = [
      { offset: 0.008, alpha: 0.18, r: 4 },
      { offset: 0.004, alpha: 0.40, r: 5.5 },
    ];
    for (const { offset, alpha, r } of trailDefs) {
      const pt = lookupPoint(lookup, progress - offset);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  const pt        = lookupPoint(lookup, progress);
  const dotColor  = isDNF ? "#444" : color;
  const dotRadius = isDNF ? 5 : 7;

  ctx.globalAlpha = isDNF ? 0.35 : 1;
  if (!isDNF) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.fill();
  ctx.shadowBlur  = 0;

  ctx.strokeStyle = isDNF ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.85)";
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  ctx.font         = "bold 7px monospace";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle    = isDNF ? "#888" : "#fff";
  ctx.globalAlpha  = isDNF ? 0.4 : 0.9;
  ctx.fillText(isDNF ? "DNF" : code, pt.x, pt.y + 9);
  ctx.globalAlpha  = 1;
}

function formatRaceTime(secs) {
  if (!secs || secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

// ── Data fetch helpers ────────────────────────────────────────────────────────

async function fetchWithRetry(url, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, delayMs)); // eslint-disable-line no-loop-func
      delayMs *= 2; continue;
    }
    return res.json();
  }
  throw new Error(`Rate limited after ${retries} retries`);
}

const STEPS = [
  "Fetching session...", "Loading circuit...", "Loading drivers...",
  "Loading laps...", "Loading tyre data...", "Processing...", "Ready",
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function RaceReplayTab() {
  // ── schedule / session ───────────────────────────────────────────────────
  const [allRaces,    setAllRaces]    = useState([]);
  const [of1Sessions, setOf1Sessions] = useState([]);
  const [selectedRace,setSelectedRace]= useState(null);
  const [initLoading, setInitLoading] = useState(true);

  // ── per-race load ────────────────────────────────────────────────────────
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

  // ── playback UI state (synced from RAF via throttle) ─────────────────────
  const [selectedLap, setSelectedLap] = useState(1);
  const [raceTime,    setRaceTime]    = useState(0);   // race seconds, for display
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [playSpeed,   setPlaySpeed]   = useState(1);

  // ── Canvas refs ──────────────────────────────────────────────────────────
  const canvasRef    = useRef(null);   // visible canvas
  const offscreenRef = useRef(null);   // offscreen canvas — track drawn once

  // ── Animation refs (zero re-renders) ─────────────────────────────────────
  const animRef        = useRef(null);
  const isPlayingRef   = useRef(false);
  const speedRef       = useRef(1);
  const lastTsRef      = useRef(null);
  const lastScrubRef   = useRef(0);    // timestamp of last selectedLap update
  const trackLookupRef = useRef([]);
  const deadRef        = useRef(false);

  // Central animation state — mutated directly, never causes re-renders
  const stateRef = useRef({ drivers: {}, currentTime: 0, maxTime: 0, totalLaps: 0 });

  // Sync UI state → refs
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current     = playSpeed; }, [playSpeed]);

  // ── RAF animation loop ────────────────────────────────────────────────────
  // Runs at 60 fps. All mutable state accessed via refs — no React deps needed.
  const animate = useCallback((timestamp) => {
    const canvas    = canvasRef.current;
    const offscreen = offscreenRef.current;

    if (canvas && offscreen) {
      const state = stateRef.current;

      // Advance race time
      if (isPlayingRef.current && lastTsRef.current !== null) {
        const dt      = (timestamp - lastTsRef.current) / 1000;
        const advance = dt * BASE_SPEED * speedRef.current;
        state.currentTime = Math.min(state.currentTime + advance, state.maxTime);
        if (state.currentTime >= state.maxTime && state.maxTime > 0) {
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      }
      lastTsRef.current = timestamp;

      // Render: copy pre-rendered track, then draw all drivers
      const ctx = canvas.getContext("2d");
      ctx.drawImage(offscreen, 0, 0);

      const lookup = trackLookupRef.current;
      if (lookup.length) {
        for (const driver of Object.values(state.drivers)) {
          const progress = getProgressAtTime(driver, state.currentTime);
          const isDNF    = driver.isRetired && state.currentTime > driver.maxTime;
          drawDriverDot(ctx, lookup, progress, driver.color, driver.code, isDNF);
        }
      }

      // Throttle React state sync to ~10 fps (scrubber + leaderboard + time display)
      if (timestamp - lastScrubRef.current > 100 && state.totalLaps > 0) {
        lastScrubRef.current = timestamp;
        const lap = Math.min(
          Math.max(1, Math.ceil(state.currentTime / (state.maxTime / state.totalLaps))),
          state.totalLaps
        );
        setSelectedLap(lap);
        setRaceTime(state.currentTime);
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }, []); // mount-only — all mutable state via refs

  // Mount: start RAF loop, create offscreen canvas
  useEffect(() => {
    offscreenRef.current = document.createElement("canvas");
    offscreenRef.current.width  = CW;
    offscreenRef.current.height = CH;
    // Fill black so first drawImage before any track loads isn't blank
    offscreenRef.current.getContext("2d").fillRect(0, 0, CW, CH);

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  // circuitPoints → rebuild trackLookup + redraw offscreen track
  useEffect(() => {
    const lookup = buildTrackLookup(circuitPoints);
    trackLookupRef.current = lookup;
    if (offscreenRef.current) {
      offscreenRef.current.getContext("2d").clearRect(0, 0, CW, CH);
      drawTrackToOffscreen(offscreenRef.current, lookup);
    }
  }, [circuitPoints]);

  // allLaps / driverMap / stints → rebuild dense driver timelines
  useEffect(() => {
    if (!allLaps.length || !totalLaps) {
      stateRef.current.drivers = {};
      stateRef.current.maxTime = 0;
      return;
    }
    const drivers = buildDriverTimelines(allLaps, totalLaps, driverMap, stints);
    const maxTime = Math.max(...Object.values(drivers).map(d => d.maxTime), 0);
    stateRef.current.drivers  = drivers;
    stateRef.current.maxTime  = maxTime;
    stateRef.current.totalLaps = totalLaps;
  }, [allLaps, totalLaps, driverMap, stints]);

  // ── Control handlers ─────────────────────────────────────────────────────
  const handlePlayToggle = useCallback(() => {
    const next = !isPlayingRef.current;
    isPlayingRef.current = next;
    if (next) lastTsRef.current = null;
    setIsPlaying(next);
  }, []);

  const handleScrub = useCallback((val) => {
    const lap   = Number(val);
    const state = stateRef.current;
    if (state.totalLaps > 0) {
      state.currentTime = ((lap - 1) / state.totalLaps) * state.maxTime;
    }
    isPlayingRef.current = false;
    lastTsRef.current    = null;
    setIsPlaying(false);
    setSelectedLap(lap);
  }, []);

  const handleReset = useCallback(() => {
    stateRef.current.currentTime = 0;
    isPlayingRef.current         = false;
    lastTsRef.current            = null;
    setIsPlaying(false);
    setSelectedLap(1);
  }, []);

  // ── Effect: schedule + sessions ──────────────────────────────────────────
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

  // ── Effect: load race data ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedRace || !of1Sessions.length) return;
    deadRef.current = false;

    // Reset everything
    setError(null); setDataReady(false);
    setDriverMap({}); setStints({}); setAllLaps([]); setErgResults([]);
    setTotalLaps(0); setCircuitPoints([]); setSelectedLap(1); setIsPlaying(false);
    isPlayingRef.current           = false;
    lastTsRef.current              = null;
    stateRef.current.currentTime   = 0;
    stateRef.current.drivers       = {};
    stateRef.current.maxTime       = 0;
    stateRef.current.totalLaps     = 0;
    setLoadPct(2); setLoadStep(STEPS[0]);

    const country  = selectedRace.Circuit.Location.country.toLowerCase();
    const locality = selectedRace.Circuit.Location.locality.toLowerCase();
    const session  = of1Sessions.find(s => s.location?.toLowerCase() === locality)
                  || of1Sessions.find(s => s.country_name?.toLowerCase() === country);

    if (!session) {
      setError(`No OpenF1 session found for ${selectedRace.raceName}.`);
      setLoadStep(null); return;
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
        // Init scrubber to end of race
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
        setLoadPct(100); setLoadStep(null); setDataReady(true);

      } catch (err) {
        if (deadRef.current) return;
        setError(`Failed to load: ${err.message}`);
        setLoadStep(null);
      }
    })();

    return () => { deadRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRace?.round, of1Sessions.length]);

  // ── Leaderboard (updates ~10 fps via selectedLap) ─────────────────────────
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
        lastLap: lastL?.lap_duration, compound: stint?.compound || "",
      };
    }).filter(d => d.lapsCompleted > 0)
      .sort((a, b) => b.lapsCompleted - a.lapsCompleted || a.cumTime - b.cumTime);

    const leaderCum  = entries[0]?.cumTime || 0;
    const leaderLaps = entries[0]?.lapsCompleted || 0;
    return entries.map((d, i) => ({
      ...d, position: i + 1,
      gap: i === 0 ? formatLap(d.cumTime)
        : d.lapsCompleted < leaderLaps ? `+${leaderLaps - d.lapsCompleted}L`
        : `+${(d.cumTime - leaderCum).toFixed(3)}s`,
    }));
  }, [allLaps, selectedLap, driverMap, stints]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (initLoading) return (
    <div style={{ textAlign:"center", padding:"5rem", color:"#444", fontFamily:"monospace", fontSize:"0.8rem" }}>
      Loading schedule...
    </div>
  );
  if (!allRaces.length) return (
    <div style={{ textAlign:"center", padding:"5rem", color:"#444", fontFamily:"monospace", fontSize:"0.8rem" }}>
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
                key={race.round} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                onClick={() => !isLoadingData && setSelectedRace(race)}
                disabled={isLoadingData}
                style={{
                  background: active ? "rgba(225,6,0,0.18)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? accent+"88" : "rgba(255,255,255,0.07)"}`,
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

      {/* ── Loading ── */}
      <AnimatePresence>
        {isLoadingData && (
          <motion.div
            initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
            style={{
              background:"rgba(8,8,16,0.9)", border:`1px solid rgba(225,6,0,0.25)`,
              borderRadius:10, padding:"1.25rem 1.5rem", marginBottom:"1.5rem",
            }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:"0.68rem", fontFamily:"monospace", color:accent, letterSpacing:"0.12em" }}>{loadStep}</span>
              <span style={{ fontSize:"0.68rem", fontFamily:"monospace", color:"#555" }}>{loadPct}%</span>
            </div>
            <div style={{ height:3, background:"rgba(255,255,255,0.05)", borderRadius:99, overflow:"hidden" }}>
              <motion.div animate={{ width:`${loadPct}%` }} transition={{ duration:0.4 }}
                style={{ height:"100%", background:`linear-gradient(90deg,${accent},#ff6b35)`, borderRadius:99 }} />
            </div>
            <div style={{ display:"flex", gap:"0.5rem", marginTop:"0.75rem", flexWrap:"wrap" }}>
              {STEPS.slice(0,-1).map((s,i) => {
                const pct  = (i+1) * (100/(STEPS.length-1));
                const done = loadPct >= pct, cur = loadStep === s;
                return (
                  <span key={i} style={{ fontSize:"0.58rem", fontFamily:"monospace", color: done?"#00e472":cur?accent:"#333", transition:"color 0.3s" }}>
                    {done?"✓":cur?"○":"·"} {s.replace("...","")}
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
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ background:"rgba(225,6,0,0.08)", border:`1px solid ${accent}44`, borderRadius:10, padding:"1rem 1.25rem", marginBottom:"1.5rem" }}>
            <div style={{ fontSize:"0.8rem", color:"#f0a0a0" }}>⚠ {error}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main layout ── */}
      {dataReady && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:"1.5rem", alignItems:"start" }}>

          {/* Left: canvas + controls */}
          <div>
            <div style={{
              background:"#080812", border:"1px solid rgba(255,255,255,0.06)",
              borderRadius:12, overflow:"hidden", marginBottom:"0.75rem",
              boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
            }}>
              {/* Canvas — track drawn to offscreen, drivers rendered each frame */}
              <canvas
                ref={canvasRef}
                width={CW}
                height={CH}
                style={{ width:"100%", display:"block" }}
              />
              {/* Lap progress bar */}
              <div style={{ height:3, background:"rgba(255,255,255,0.04)" }}>
                <motion.div
                  animate={{ width:`${lapPct}%` }}
                  transition={{ duration:0.15 }}
                  style={{ height:"100%", background:`linear-gradient(90deg,${accent},#ff6b35)` }}
                />
              </div>
            </div>

            {/* Legend */}
            <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", marginBottom:"0.6rem", padding:"0.5rem 0.75rem", background:"rgba(8,8,16,0.7)", borderRadius:8, border:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize:"0.58rem", color:"#444", fontFamily:"monospace" }}>
                <span style={{ color:"#666" }}>●</span> Estimated track position from lap timing — not real GPS
              </span>
              <span style={{ fontSize:"0.58rem", color:"#444", fontFamily:"monospace" }}>
                <span style={{ color:"#888" }}>spacing</span> = time gap ÷ avg lap time → track %
              </span>
              <span style={{ fontSize:"0.58rem", color:"#444", fontFamily:"monospace" }}>
                <span style={{ color:"#555" }}>DNF</span> = retired, shown at final lap crossing
              </span>
            </div>

            {/* Playback controls */}
            <div style={{ background:"rgba(10,10,20,0.9)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:"1rem 1.25rem", backdropFilter:"blur(12px)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.85rem" }}>
                <motion.button whileTap={{ scale:0.9 }} onClick={handlePlayToggle} style={{
                  width:38, height:38, borderRadius:"50%", border:"none",
                  background: isPlaying ? "linear-gradient(135deg,#f5c518,#e8a800)" : `linear-gradient(135deg,${accent},#ff6b35)`,
                  color:"#000", fontWeight:700, fontSize:"1rem", cursor:"pointer", flexShrink:0,
                }}>{isPlaying ? "⏸" : "▶"}</motion.button>
                <motion.button whileTap={{ scale:0.9 }} onClick={handleReset} style={{
                  width:32, height:32, borderRadius:"50%",
                  border:"1px solid rgba(255,255,255,0.08)", background:"transparent",
                  color:"#555", cursor:"pointer", fontSize:"0.85rem", flexShrink:0,
                }} title="Reset">↺</motion.button>
                <div style={{ display:"flex", flexDirection:"column", gap:"0.1rem" }}>
                  <span style={{ fontSize:"0.78rem", fontFamily:"monospace", color:"#888" }}>
                    Lap <span style={{ color:"#fff", fontVariantNumeric:"tabular-nums" }}>{selectedLap}</span>
                    <span style={{ color:"#333" }}> / </span>
                    <span style={{ color:"#555" }}>{totalLaps}</span>
                  </span>
                  <span style={{ fontSize:"0.62rem", fontFamily:"monospace", color:"#444", fontVariantNumeric:"tabular-nums" }}>
                    {formatRaceTime(raceTime)}
                    {totalLaps > 0 && (
                      <span style={{ color:"#2a2a3a" }}> / {formatRaceTime(stateRef.current.maxTime)}</span>
                    )}
                  </span>
                </div>
                <div style={{ display:"flex", gap:3, marginLeft:"auto" }}>
                  {[0.5,1,2,4,8].map(s => (
                    <motion.button key={s} whileTap={{ scale:0.92 }} onClick={() => setPlaySpeed(s)} style={{
                      background: playSpeed===s ? "rgba(225,6,0,0.2)" : "transparent",
                      border: `1px solid ${playSpeed===s ? accent+"88" : "rgba(255,255,255,0.07)"}`,
                      color: playSpeed===s ? accent : "#555",
                      padding:"0.2rem 0.45rem", borderRadius:5, cursor:"pointer",
                      fontSize:"0.62rem", fontFamily:"monospace", fontWeight:700,
                    }}>{s}×</motion.button>
                  ))}
                </div>
              </div>
              <input type="range" min={1} max={totalLaps||1} step={1}
                value={selectedLap}
                onChange={e => handleScrub(e.target.value)}
                style={{ width:"100%", marginBottom:"0.35rem" }}
              />
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.58rem", color:"#2a2a3a", fontFamily:"monospace" }}>
                <span>L1</span>
                <span style={{ color:accent }}>
                  L{selectedLap} · {formatRaceTime(raceTime)}
                </span>
                <span>L{totalLaps}</span>
              </div>
            </div>
          </div>

          {/* Right: leaderboard */}
          <div>
            <SectionLabel>Leaderboard — Lap {selectedLap}</SectionLabel>
            {replayLeaderboard.length > 0 ? (
              <motion.div layout>
                <AnimatePresence mode="popLayout" initial={false}>
                  {replayLeaderboard.map((d, i) => {
                    const cColor = COMP_COLOR[d.compound] || "#444";
                    const posClr = i===0 ? accent : i===1 ? "#C0C0C0" : i===2 ? "#CD7F32" : "#444";
                    return (
                      <motion.div key={d.num} layout="position"
                        initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:16 }}
                        transition={{ layout:{ duration:0.3, ease:"easeOut" }, duration:0.2 }}
                        style={{
                          display:"flex", alignItems:"center", gap:"0.5rem",
                          padding:"0.5rem 0.75rem",
                          background: i%2===0 ? "rgba(14,14,26,0.8)" : "rgba(10,10,20,0.8)",
                          borderLeft:`3px solid ${d.teamColor}`,
                          marginBottom:2, borderRadius:6,
                        }}>
                        <span style={{ fontFamily:"monospace", fontSize:"0.8rem", width:20, flexShrink:0, color:posClr, fontWeight:700 }}>{d.position}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"0.35rem" }}>
                            <span style={{ fontWeight:700, fontSize:"0.8rem", color:d.teamColor }}>{d.code}</span>
                            <span style={{ fontSize:"0.64rem", color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.fullName}</span>
                          </div>
                          <span style={{ fontSize:"0.58rem", color:"#333", fontFamily:"monospace" }}>L{d.lapsCompleted}</span>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <div style={{ fontSize:"0.66rem", fontFamily:"monospace", color:i===0?"#00e472":"#555" }}>{d.gap}</div>
                          {d.lastLap && <div style={{ fontSize:"0.62rem", fontFamily:"monospace", color:"#444" }}>{formatLap(d.lastLap)}</div>}
                        </div>
                        {d.compound && (
                          <div style={{ fontSize:"0.6rem", fontWeight:700, color:cColor, background:`${cColor}18`, border:`1px solid ${cColor}44`, borderRadius:4, padding:"0.1rem 0.25rem", flexShrink:0 }}>
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
                <div style={{ fontSize:"0.62rem", color:"#333", fontFamily:"monospace", marginBottom:"0.5rem" }}>
                  Official result (no lap-by-lap data)
                </div>
                {ergResults.slice(0,12).map((r,i) => (
                  <div key={i} style={{
                    display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.45rem 0.75rem",
                    background: i%2===0 ? "rgba(14,14,26,0.8)" : "rgba(10,10,20,0.8)",
                    marginBottom:2, borderRadius:6,
                  }}>
                    <span style={{ fontFamily:"monospace", fontSize:"0.75rem", width:20, flexShrink:0, color:i<3?[accent,"#C0C0C0","#CD7F32"][i]:"#333", fontWeight:700 }}>{r.position}</span>
                    <span style={{ flex:1, fontSize:"0.78rem" }}>{r.Driver.givenName} {r.Driver.familyName}</span>
                    <span style={{ fontSize:"0.68rem", fontFamily:"monospace", color:"#555" }}>
                      {i===0?(r.Time?.time||"—"):r.Time?.time?`+${r.Time.time}`:r.status}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ color:"#333", padding:"2rem", textAlign:"center", fontSize:"0.78rem" }}>
                No lap data available.
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
