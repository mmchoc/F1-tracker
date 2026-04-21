import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionLabel, pageVariants } from "./ui";
import { ERGAST, OF1, COUNTRY_FLAGS, theme, formatLap } from "../constants";

const { accent } = theme;

// ── Canvas & engine constants ─────────────────────────────────────────────────
const CW = 1000, CH = 560;
const LOOKUP_N   = 2000;   // evenly-spaced track lookup points
const BASE_SPEED = 3;      // race-sec per real-sec at 1×
const SUB_LAPS   = 20;     // timeline sub-samples per lap (smoother interp)
const TRAIL_N    = 7;      // motion-blur ghost dots

// ── Circuit GeoJSON (bacinger/f1-circuits) ────────────────────────────────────
const GJ_BASE = "https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits";
const CIRCUIT_FILES = {
  albert_park:"au-1953", shanghai:"cn-2004",   suzuka:"jp-1962",
  bahrain:"bh-2002",     jeddah:"sa-2021",      monaco:"mc-1929",
  villeneuve:"ca-1978",  catalunya:"es-2026",   red_bull_ring:"at-1969",
  silverstone:"gb-1948", hungaroring:"hu-1986", spa:"be-1925",
  zandvoort:"nl-1948",   monza:"it-1953",       baku:"az-2016",
  marina_bay:"sg-2008",  americas:"us-2012",    rodriguez:"mx-1962",
  interlagos:"br-1977",  vegas:"us-2023",       losail:"qa-2004",
  yas_marina:"ae-2009",
};

// ── Tyre + event styling ──────────────────────────────────────────────────────
const TYRE = {
  SOFT:         { color:"#e8002d", bg:"#e8002d22", label:"S" },
  MEDIUM:       { color:"#ffd700", bg:"#ffd70022", label:"M" },
  HARD:         { color:"#e8e8e8", bg:"#e8e8e822", label:"H" },
  INTERMEDIATE: { color:"#39b54a", bg:"#39b54a22", label:"I" },
  WET:          { color:"#0067ff", bg:"#0067ff22", label:"W" },
};

const EV = {
  sc:      { color:"#f5c518", bg:"#f5c51820", label:"SAFETY CAR"  },
  vsc:     { color:"#ff8c00", bg:"#ff8c0020", label:"VSC"         },
  dnf:     { color:"#ff4444", bg:"#ff444420", label:"DNF"         },
  pit:     { color:"#00e472", bg:"#00e47220", label:"PIT STOP"    },
  fastest: { color:"#cc88ff", bg:"#cc88ff20", label:"FASTEST LAP" },
  flag:    { color:"#ff4444", bg:"#ff444420", label:"RED FLAG"    },
};

// ── Coordinate helpers ────────────────────────────────────────────────────────
async function fetchCircuitPts(circuitId) {
  const fileId = CIRCUIT_FILES[circuitId];
  if (!fileId) return [];
  try {
    const res = await fetch(`${GJ_BASE}/${fileId}.geojson`);
    if (!res.ok) return [];
    const geo = await res.json();
    const feat = geo?.features?.find(f => f.geometry?.type === "LineString") || geo?.features?.[0];
    const coords = feat?.geometry?.coordinates;
    return Array.isArray(coords) ? normalizeCoords(coords) : [];
  } catch { return []; }
}

function normalizeCoords(coords, W = CW, H = CH, pad = 64) {
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
    y: H - (oy + (lat - minLat) * scale),
  }));
}

function buildCumDists(pts) {
  const c = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
    c.push(c[i-1] + Math.sqrt(dx*dx + dy*dy));
  }
  const dx = pts[0].x - pts[pts.length-1].x, dy = pts[0].y - pts[pts.length-1].y;
  return { cum: c, total: c[c.length-1] + Math.sqrt(dx*dx + dy*dy) };
}

function ptAtProgress(pts, cum, total, p) {
  const target = ((p % 1) + 1) % 1 * total;
  const max = cum[cum.length - 1];
  let a, b;
  if (target >= max) {
    const t = max > 0 ? (target - max) / (total - max) : 0;
    a = pts[pts.length - 1]; b = pts[0];
    return { x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t, ang: Math.atan2(b.y-a.y, b.x-a.x) };
  }
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo+hi)>>1; if (cum[m] <= target) lo=m; else hi=m; }
  a = pts[lo]; b = pts[hi];
  const seg = cum[hi] - cum[lo];
  const t   = seg > 0 ? (target - cum[lo]) / seg : 0;
  return { x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t, ang: Math.atan2(b.y-a.y, b.x-a.x) };
}

function buildLookup(pts) {
  if (pts.length < 2) return [];
  const { cum, total } = buildCumDists(pts);
  return Array.from({ length: LOOKUP_N }, (_, i) => ptAtProgress(pts, cum, total, i / LOOKUP_N));
}

function lerpLookup(lookup, progress) {
  if (!lookup.length) return { x: CW/2, y: CH/2, ang: 0 };
  const norm = ((progress % 1) + 1) % 1;
  const raw  = norm * LOOKUP_N;
  const idx  = Math.floor(raw) % LOOKUP_N;
  const nxt  = (idx + 1) % LOOKUP_N;
  const f    = raw - Math.floor(raw);
  const a = lookup[idx], b = lookup[nxt];
  return { x: a.x+(b.x-a.x)*f, y: a.y+(b.y-a.y)*f, ang: a.ang+(b.ang-a.ang)*f };
}

// ── Static track layer ────────────────────────────────────────────────────────
function renderTrack(off, lookup) {
  const ctx = off.getContext("2d");
  ctx.fillStyle = "#080810";
  ctx.fillRect(0, 0, CW, CH);
  if (!lookup.length) return;

  // Build closed path from lookup
  const path = () => {
    const p = new Path2D();
    p.moveTo(lookup[0].x, lookup[0].y);
    for (let i = 1; i < lookup.length; i++) p.lineTo(lookup[i].x, lookup[i].y);
    p.closePath();
    return p;
  };

  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const p = path();

  // Outer glow → tarmac layers (widest first)
  for (const [lw, style] of [
    [36, "rgba(255,255,255,0.025)"],
    [26, "#0e0e1c"],
    [18, "#13132098"],
    [12, "#1a1a2e"],
    [7,  "#1f1f38"],
    [3.5,"#282845"],
  ]) { ctx.lineWidth = lw; ctx.strokeStyle = style; ctx.stroke(p); }

  // Faint racing line
  ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.055)"; ctx.stroke(p);

  // Sector boundary ticks + labels at 1/3 and 2/3 of the circuit
  const sColors = ["#e10600","#f5c518","#cc88ff"];
  for (let s = 1; s <= 2; s++) {
    const idx = Math.round((s / 3) * LOOKUP_N) % LOOKUP_N;
    const pt  = lookup[idx];
    const ang = pt.ang + Math.PI / 2;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(ang);
    ctx.strokeStyle = sColors[s];
    ctx.lineWidth   = 2.5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.restore();

    // Tiny sector label just ahead of the tick
    const ahead = lookup[(idx + 25) % LOOKUP_N];
    ctx.save();
    ctx.font         = "bold 9px monospace";
    ctx.fillStyle    = sColors[s];
    ctx.globalAlpha  = 0.45;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`S${s + 1}`, ahead.x, ahead.y);
    ctx.restore();
  }

  // Start/finish chequered flag marker
  const sf  = lookup[0];
  const sf2 = lookup[5] || lookup[1];
  const ang = Math.atan2(sf2.y - sf.y, sf2.x - sf.x) + Math.PI / 2;
  ctx.save();
  ctx.translate(sf.x, sf.y);
  ctx.rotate(ang);
  const sq = 3.5;
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 2; r++) {
      ctx.fillStyle = (c + r) % 2 === 0 ? "#fff" : "#111";
      ctx.fillRect(-sq * 2 + c * sq, -sq + r * sq, sq, sq);
    }
  }
  ctx.restore();
}

// ── Driver dot ────────────────────────────────────────────────────────────────
function drawDot(ctx, lookup, progress, color, code, isDNF, isSel, inBattle) {
  if (!lookup.length) return;
  const pt = lerpLookup(lookup, progress);

  if (!isDNF) {
    // Motion-blur trail (ghost dots)
    for (let i = TRAIL_N; i >= 1; i--) {
      const tp = lerpLookup(lookup, progress - i * 0.005);
      ctx.globalAlpha = (TRAIL_N - i + 1) / TRAIL_N * 0.22;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 4 + (TRAIL_N - i) * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  const r = isDNF ? 5.5 : isSel ? 9.5 : inBattle ? 8.5 : 7.5;

  // Outer glow
  if (!isDNF) {
    ctx.globalAlpha = isSel ? 0.45 : inBattle ? 0.25 : 0.15;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r + 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Selected ring
  if (isSel) {
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r + 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }

  // Battle dashed ring
  if (inBattle && !isSel) {
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r + 3.5, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Main circle
  ctx.globalAlpha = isDNF ? 0.28 : 1;
  ctx.shadowColor = isDNF ? "transparent" : color;
  ctx.shadowBlur  = isDNF ? 0 : isSel ? 18 : 10;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
  ctx.fillStyle = isDNF ? "#2a2a2a" : color;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Border
  ctx.globalAlpha = isDNF ? 0.18 : 1;
  ctx.strokeStyle = isDNF ? "#444" : "rgba(255,255,255,0.9)";
  ctx.lineWidth   = isDNF ? 1 : 1.5;
  ctx.stroke();

  // Label
  ctx.globalAlpha  = isDNF ? 0.25 : 0.95;
  ctx.font         = `bold ${isDNF ? 6 : 7}px monospace`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle    = isDNF ? "#666" : "#fff";
  ctx.fillText(isDNF ? "✕" : code, pt.x, pt.y);
  ctx.globalAlpha  = 1;
}

// ── Loading canvas: animated circuit trace ────────────────────────────────────
function drawLoadingFrame(canvas, lookup, progress, raceName) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!lookup.length) return;

  // Scale lookup to fit the loading canvas
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const pt of lookup) {
    if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y;
  }
  const pad = 24;
  const sx = (W - pad*2) / (maxX - minX || 1);
  const sy = (H - pad*2) / (maxY - minY || 1);
  const sc = Math.min(sx, sy);
  const dx = (W - (maxX - minX) * sc) / 2 - minX * sc;
  const dy = (H - (maxY - minY) * sc) / 2 - minY * sc;
  const tx = pt => pt.x * sc + dx;
  const ty = pt => pt.y * sc + dy;

  const total = lookup.length;
  const drawn = Math.floor(progress * total);

  // Dim complete outline (base)
  ctx.beginPath();
  ctx.moveTo(tx(lookup[0]), ty(lookup[0]));
  for (let i = 1; i < total; i++) ctx.lineTo(tx(lookup[i]), ty(lookup[i]));
  ctx.closePath();
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth   = 3;
  ctx.lineJoin    = "round"; ctx.lineCap = "round";
  ctx.stroke();

  // Animated drawn portion
  if (drawn > 1) {
    ctx.beginPath();
    ctx.moveTo(tx(lookup[0]), ty(lookup[0]));
    for (let i = 1; i < drawn; i++) ctx.lineTo(tx(lookup[i]), ty(lookup[i]));
    ctx.strokeStyle = accent;
    ctx.lineWidth   = 3;
    ctx.shadowColor = accent;
    ctx.shadowBlur  = 12;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Bright leading dot
    const head = lookup[drawn - 1];
    ctx.beginPath();
    ctx.arc(tx(head), ty(head), 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#fff";
    ctx.shadowBlur  = 16;
    ctx.fill();
    ctx.shadowBlur  = 0;
  }
}

// ── Timeline helpers ──────────────────────────────────────────────────────────
function buildTimelines(allLaps, totalLaps, driverMap, stints) {
  const byDrv = {};
  for (const l of allLaps) {
    const k = String(l.driver_number);
    (byDrv[k] = byDrv[k] || []).push(l);
  }

  const raceStartMs = allLaps
    .filter(l => l.lap_number === 1 && l.date_start)
    .reduce((mn, l) => Math.min(mn, Date.parse(l.date_start)), Infinity);
  const hasTs = raceStartMs !== Infinity;

  const result = {};

  for (const [num, laps] of Object.entries(byDrv)) {
    const sorted = laps
      .filter(l => l.lap_number != null && l.lap_duration > 0)
      .sort((a, b) => a.lap_number - b.lap_number);
    if (sorted.length < 3) continue;

    // Fill missing laps with interpolated synthetics
    const filled = [];
    for (let i = 0; i < sorted.length; i++) {
      filled.push(sorted[i]);
      if (i < sorted.length - 1) {
        const cur = sorted[i], nxt = sorted[i+1];
        const gap = nxt.lap_number - cur.lap_number;
        if (gap > 1) {
          for (let j = 1; j < gap; j++) {
            let synDate = null, synDur;
            if (hasTs && cur.date_start && nxt.date_start) {
              const prevEnd = Date.parse(cur.date_start) + cur.lap_duration * 1000;
              const nxtMs   = Date.parse(nxt.date_start);
              const slice   = (nxtMs - prevEnd) / (gap - 1);
              synDate = new Date(prevEnd + (j-1)*slice).toISOString();
              synDur  = slice / 1000;
            } else {
              synDur = (cur.lap_duration + nxt.lap_duration) / 2;
            }
            filled.push({
              lap_number: cur.lap_number + j,
              lap_duration: Math.max(synDur, 10),
              date_start: synDate,
              driver_number: cur.driver_number,
            });
          }
        }
      }
    }

    const maxLap    = sorted[sorted.length - 1].lap_number;
    const isRetired = maxLap < totalLaps;
    const drv       = driverMap[num] || {};
    const stint     = stints[num];

    const samples = [{ t: 0, progress: 0 }];
    let ft = 0;
    for (const lap of filled) {
      const lapN = lap.lap_number;
      let ls;
      if (hasTs && lap.date_start) { ls = (Date.parse(lap.date_start) - raceStartMs)/1000; ft = ls; }
      else { ls = ft; }
      for (let sub = 1; sub <= SUB_LAPS; sub++) {
        const f = sub / SUB_LAPS;
        samples.push({ t: ls + f * lap.lap_duration, progress: lapN - 1 + f });
      }
      ft = ls + lap.lap_duration;
    }

    result[num] = {
      num, code: drv.name_acronym || `#${num}`,
      fullName: drv.full_name || "",
      color: drv.team_colour ? `#${drv.team_colour}` : "#888",
      compound: stint?.compound || "",
      samples, maxTime: samples[samples.length-1].t,
      isRetired, retiredLap: isRetired ? maxLap : null, maxLap,
    };
  }
  return result;
}

function progressAt(driver, t) {
  const { samples } = driver;
  if (!samples.length) return 0;
  if (t <= samples[0].t) return samples[0].progress;
  const last = samples[samples.length - 1];
  if (t >= last.t) return last.progress;
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) { const m = (lo+hi)>>1; if (samples[m].t <= t) lo=m; else hi=m; }
  const a = samples[lo], b = samples[hi];
  const alpha = (t - a.t) / (b.t - a.t);
  const s = alpha * alpha * (3 - 2 * alpha);  // smoothstep
  return a.progress + s * (b.progress - a.progress);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function fmtTime(secs) {
  if (!secs || secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
               : `${m}:${String(s).padStart(2,"0")}`;
}

async function apiFetch(url) {
  let delay = 1500;
  for (let i = 0; i < 3; i++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await fetch(url);
      if (r.status === 429) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(res => setTimeout(res, delay));
        delay *= 2; continue;
      }
      if (!r.ok) return null;
      return r.json();
    } catch {
      if (i === 2) return null;
      // eslint-disable-next-line no-await-in-loop
      await new Promise(res => setTimeout(res, delay));
    }
  }
  return null;
}

// ── Load stage definitions ────────────────────────────────────────────────────
const STAGES = [
  { key:"session",   label:"Fetching session",    pct:6  },
  { key:"circuit",   label:"Loading circuit",      pct:16 },
  { key:"drivers",   label:"Loading drivers",      pct:28 },
  { key:"laps",      label:"Loading lap data",     pct:44 },
  { key:"stints",    label:"Loading tyre data",    pct:58 },
  { key:"pits",      label:"Loading pit stops",    pct:66 },
  { key:"intervals", label:"Loading intervals",    pct:74 },
  { key:"events",    label:"Loading race events",  pct:83 },
  { key:"weather",   label:"Loading weather",      pct:90 },
  { key:"build",     label:"Building animation",   pct:97 },
];

// ═══════════════════════════════════════════════════════════════════════════════
export default function RaceReplayTab() {

  // ── Schedule / session ───────────────────────────────────────────────────
  const [allRaces,     setAllRaces]     = useState([]);
  const [of1Sessions,  setOf1Sessions]  = useState([]);
  const [selectedRace, setSelectedRace] = useState(null);
  const [initLoading,  setInitLoading]  = useState(true);

  // ── Loading state ────────────────────────────────────────────────────────
  const [loadStage,  setLoadStage]  = useState(null);  // current stage label
  const [loadPct,    setLoadPct]    = useState(0);
  const [error,      setError]      = useState(null);
  const [dataReady,  setDataReady]  = useState(false);

  // ── Race data ────────────────────────────────────────────────────────────
  const [driverMap,  setDriverMap]  = useState({});
  const [allLaps,    setAllLaps]    = useState([]);
  const [allStints,  setAllStints]  = useState([]);
  const [stints,     setStints]     = useState({});   // last stint per driver
  const [allPits,    setAllPits]    = useState([]);
  const [raceCtrl,   setRaceCtrl]   = useState([]);
  const [wxData,     setWxData]     = useState([]);
  const [ergRes,     setErgRes]     = useState([]);
  const [totalLaps,  setTotalLaps]  = useState(0);
  const [circuitPts, setCircuitPts] = useState([]);

  // ── Playback UI (kept in sync with RAF via throttle) ─────────────────────
  const [selLap,     setSelLap]     = useState(1);
  const [raceTime,   setRaceTime]   = useState(0);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [speed,      setSpeed]      = useState(1);
  const [selDriver,  setSelDriver]  = useState(null);  // highlighted driver num (string)

  // ── Canvas refs ──────────────────────────────────────────────────────────
  const canvasRef   = useRef(null);   // main visible canvas
  const offRef      = useRef(null);   // offscreen: static track drawn once
  const loadCvsRef  = useRef(null);   // loading animation canvas

  // ── Animation refs ────────────────────────────────────────────────────────
  const rafRef       = useRef(null);
  const loadRafRef   = useRef(null);
  const playRef      = useRef(false);
  const speedRef     = useRef(1);
  const lastTsRef    = useRef(null);
  const lastSyncRef  = useRef(0);
  const lookupRef    = useRef([]);
  const deadRef      = useRef(false);
  const selDrvRef    = useRef(null);
  const stateRef     = useRef({ drivers:{}, currentTime:0, maxTime:0, totalLaps:0 });
  const loadPctRef   = useRef(0);

  useEffect(() => { playRef.current  = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speed;     }, [speed]);
  useEffect(() => { selDrvRef.current = selDriver;}, [selDriver]);
  useEffect(() => { loadPctRef.current = loadPct; }, [loadPct]);

  // ── Main RAF loop (60fps) ────────────────────────────────────────────────
  const animate = useCallback((ts) => {
    const canvas = canvasRef.current;
    const off    = offRef.current;
    if (canvas && off) {
      const state = stateRef.current;

      // Advance race time
      if (playRef.current && lastTsRef.current !== null) {
        const dt = Math.min((ts - lastTsRef.current) / 1000, 0.1);
        state.currentTime = Math.min(state.currentTime + dt * BASE_SPEED * speedRef.current, state.maxTime);
        if (state.currentTime >= state.maxTime && state.maxTime > 0) {
          playRef.current = false;
          setIsPlaying(false);
        }
      }
      lastTsRef.current = ts;

      // Draw: blit static track then overlay drivers
      const ctx    = canvas.getContext("2d");
      const lookup = lookupRef.current;
      ctx.drawImage(off, 0, 0);

      if (lookup.length) {
        const sel      = selDrvRef.current;
        const drivers  = Object.values(state.drivers);
        const progMap  = {};
        for (const d of drivers) progMap[d.num] = progressAt(d, state.currentTime);

        // Battle lines: drivers within ~1s gap on track
        for (let i = 0; i < drivers.length - 1; i++) {
          for (let j = i+1; j < drivers.length; j++) {
            const gap = Math.abs(progMap[drivers[i].num] - progMap[drivers[j].num]);
            if (gap < 0.014 && gap > 0.0002) {
              const p1 = lerpLookup(lookup, progMap[drivers[i].num]);
              const p2 = lerpLookup(lookup, progMap[drivers[j].num]);
              ctx.globalAlpha = 0.18;
              ctx.strokeStyle = "#4499ff";
              ctx.lineWidth   = 1.5;
              ctx.setLineDash([2, 4]);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.globalAlpha = 1;
            }
          }
        }

        for (const d of drivers) {
          const prog     = progMap[d.num];
          const isDNF    = d.isRetired && state.currentTime > d.maxTime;
          const isSel    = sel === d.num;
          const inBattle = drivers.some(o => o.num !== d.num
            && Math.abs(progMap[o.num] - prog) < 0.014
            && Math.abs(progMap[o.num] - prog) > 0.0002);
          drawDot(ctx, lookup, prog, d.color, d.code, isDNF, isSel, inBattle);
        }
      }

      // Throttled React sync ~10fps
      if (ts - lastSyncRef.current > 100 && state.totalLaps > 0) {
        lastSyncRef.current = ts;
        const lap = Math.min(Math.max(1, Math.ceil(state.currentTime / (state.maxTime / state.totalLaps))), state.totalLaps);
        setSelLap(lap);
        setRaceTime(state.currentTime);
      }
    }
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  // ── Loading animation RAF ─────────────────────────────────────────────────
  const loadPtsRef  = useRef([]);  // lookup for loading canvas
  const drawProgRef = useRef(0);

  const animateLoad = useCallback((ts) => {
    const canvas = loadCvsRef.current;
    if (!canvas) { loadRafRef.current = requestAnimationFrame(animateLoad); return; }
    const target = loadPctRef.current / 100;
    drawProgRef.current += (target - drawProgRef.current) * 0.04 + 0.003;
    drawProgRef.current = Math.min(drawProgRef.current, 1);
    drawLoadingFrame(canvas, loadPtsRef.current, drawProgRef.current, "");
    loadRafRef.current = requestAnimationFrame(animateLoad);
  }, []);

  // Mount: create offscreen canvas, start both RAF loops
  useEffect(() => {
    offRef.current = document.createElement("canvas");
    offRef.current.width  = CW;
    offRef.current.height = CH;
    const ctx = offRef.current.getContext("2d");
    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, CW, CH);

    rafRef.current     = requestAnimationFrame(animate);
    loadRafRef.current = requestAnimationFrame(animateLoad);
    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(loadRafRef.current);
    };
  }, [animate, animateLoad]);

  // circuitPts → build lookup, redraw static track, feed to loading canvas
  useEffect(() => {
    const lookup = buildLookup(circuitPts);
    lookupRef.current = lookup;
    loadPtsRef.current = lookup;
    if (offRef.current) renderTrack(offRef.current, lookup);
  }, [circuitPts]);

  // allLaps + driverMap + stints → rebuild timelines
  useEffect(() => {
    if (!allLaps.length || !totalLaps) {
      stateRef.current.drivers   = {};
      stateRef.current.maxTime   = 0;
      stateRef.current.totalLaps = 0;
      return;
    }
    const drivers  = buildTimelines(allLaps, totalLaps, driverMap, stints);
    const maxTime  = Math.max(...Object.values(drivers).map(d => d.maxTime), 0);
    stateRef.current.drivers   = drivers;
    stateRef.current.maxTime   = maxTime;
    stateRef.current.totalLaps = totalLaps;
  }, [allLaps, totalLaps, driverMap, stints]);

  // ── Keyboard shortcut: Space = play/pause ─────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (e.code === "Space" && dataReady && e.target.tagName !== "INPUT") {
        e.preventDefault();
        const next = !playRef.current;
        playRef.current = next;
        if (next) lastTsRef.current = null;
        setIsPlaying(next);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [dataReady]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const playToggle = useCallback(() => {
    const next = !playRef.current;
    playRef.current = next;
    if (next) lastTsRef.current = null;
    setIsPlaying(next);
  }, []);

  const scrub = useCallback((val) => {
    const lap = Number(val);
    const s   = stateRef.current;
    if (s.totalLaps > 0) s.currentTime = ((lap - 1) / s.totalLaps) * s.maxTime;
    playRef.current = false; lastTsRef.current = null;
    setIsPlaying(false); setSelLap(lap);
  }, []);

  const reset = useCallback(() => {
    stateRef.current.currentTime = 0;
    playRef.current = false; lastTsRef.current = null;
    setIsPlaying(false); setSelLap(1); setRaceTime(0);
  }, []);

  // ── Load schedule ─────────────────────────────────────────────────────────
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      fetch(`${ERGAST}/2026.json`).then(r => r.json()).catch(() => null),
      apiFetch(`${OF1}/sessions?year=2026&session_name=Race`),
    ]).then(([erg, of1]) => {
      const races    = (erg?.MRData?.RaceTable?.Races || []).filter(r => r.date <= today);
      const sessions = Array.isArray(of1) ? of1 : [];
      setAllRaces(races);
      setOf1Sessions(sessions);
      if (races.length) setSelectedRace(races[races.length - 1]);
      setInitLoading(false);
    }).catch(() => setInitLoading(false));
  }, []);

  // ── Load race data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedRace || !of1Sessions.length) return;
    deadRef.current  = false;
    drawProgRef.current = 0;

    // Reset
    setError(null); setDataReady(false); setLoadPct(0);
    setDriverMap({}); setAllLaps([]); setAllStints([]); setStints({});
    setAllPits([]); setRaceCtrl([]); setWxData([]); setErgRes([]);
    setTotalLaps(0); setCircuitPts([]); setSelLap(1); setIsPlaying(false); setSelDriver(null);
    playRef.current = false; lastTsRef.current = null;
    stateRef.current = { drivers:{}, currentTime:0, maxTime:0, totalLaps:0 };

    const country  = selectedRace.Circuit.Location.country.toLowerCase();
    const locality = selectedRace.Circuit.Location.locality.toLowerCase();
    const session  = of1Sessions.find(s => s.location?.toLowerCase() === locality)
                  || of1Sessions.find(s => s.country_name?.toLowerCase() === country);

    if (!session) {
      setError(`No OpenF1 session found for ${selectedRace.raceName}.`);
      return;
    }

    const sk    = session.session_key;
    const round = selectedRace.round;

    const go = async () => {
      const step = (label, pct) => {
        if (deadRef.current) return;
        setLoadStage(label); setLoadPct(pct);
      };
      try {
        step(STAGES[0].label, STAGES[0].pct);

        step(STAGES[1].label, STAGES[1].pct);
        const pts = await fetchCircuitPts(selectedRace.Circuit.circuitId);
        if (deadRef.current) return;
        setCircuitPts(pts);

        step(STAGES[2].label, STAGES[2].pct);
        const drvsD = await apiFetch(`${OF1}/drivers?session_key=${sk}`);
        if (deadRef.current) return;
        const drvsArr = Array.isArray(drvsD) ? drvsD : [];
        const drvsMap = {};
        drvsArr.forEach(d => { drvsMap[String(d.driver_number)] = d; });
        setDriverMap(drvsMap);

        step(STAGES[3].label, STAGES[3].pct);
        const lapD = await apiFetch(`${OF1}/laps?session_key=${sk}`);
        if (deadRef.current) return;
        const laps   = Array.isArray(lapD) ? lapD : [];
        const maxLap = laps.reduce((m, l) => Math.max(m, l.lap_number || 0), 0);
        setAllLaps(laps); setTotalLaps(maxLap); setSelLap(maxLap || 1);

        step(STAGES[4].label, STAGES[4].pct);
        const stD = await apiFetch(`${OF1}/stints?session_key=${sk}`);
        if (deadRef.current) return;
        const stArr = Array.isArray(stD) ? stD : [];
        const stMap = {};
        stArr.forEach(s => {
          const k = String(s.driver_number);
          if (!stMap[k] || s.stint_number > stMap[k].stint_number) stMap[k] = s;
        });
        setStints(stMap); setAllStints(stArr);

        step(STAGES[5].label, STAGES[5].pct);
        const pitD = await apiFetch(`${OF1}/pit?session_key=${sk}`);
        if (deadRef.current) return;
        setAllPits(Array.isArray(pitD) ? pitD : []);

        step(STAGES[6].label, STAGES[6].pct);
        // intervals can be huge — cap at 10s
        const intD = await Promise.race([
          apiFetch(`${OF1}/intervals?session_key=${sk}`),
          new Promise(r => setTimeout(() => r(null), 10000)),
        ]);
        if (deadRef.current) return;
        // intervals used for future gap accuracy; stored but not yet visualised
        void intD;

        step(STAGES[7].label, STAGES[7].pct);
        const rcD = await apiFetch(`${OF1}/race_control?session_key=${sk}`);
        if (deadRef.current) return;
        setRaceCtrl(Array.isArray(rcD) ? rcD : []);

        step(STAGES[8].label, STAGES[8].pct);
        const wxD = await apiFetch(`${OF1}/weather?session_key=${sk}`);
        if (deadRef.current) return;
        setWxData(Array.isArray(wxD) ? wxD : []);

        const ergD = await fetch(`${ERGAST}/2026/${round}/results.json`).then(r=>r.json()).catch(()=>null);
        if (deadRef.current) return;
        setErgRes(ergD?.MRData?.RaceTable?.Races?.[0]?.Results || []);

        step(STAGES[9].label, STAGES[9].pct);
        await new Promise(r => setTimeout(r, 250));
        if (deadRef.current) return;

        setLoadPct(100); setLoadStage(null); setDataReady(true);

      } catch (err) {
        if (!deadRef.current) { setError(`Load failed: ${err.message}`); setLoadStage(null); }
      }
    };

    go();
    return () => { deadRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRace?.round, of1Sessions.length]);

  // ── Derived: leaderboard ──────────────────────────────────────────────────
  const leaderboard = useMemo(() => {
    if (!allLaps.length) return [];

    const byDrv = {};
    for (const l of allLaps) {
      const k = String(l.driver_number);
      (byDrv[k] = byDrv[k] || []).push(l);
    }

    const stintsByDrv = {};
    for (const s of allStints) {
      const k = String(s.driver_number);
      (stintsByDrv[k] = stintsByDrv[k] || []).push(s);
    }

    const entries = Object.entries(byDrv).map(([num, laps]) => {
      const done = laps
        .filter(l => l.lap_number != null && l.lap_number <= selLap && l.lap_duration != null)
        .sort((a, b) => a.lap_number - b.lap_number);
      if (!done.length) return null;

      const maxL   = done[done.length - 1].lap_number;
      const cumT   = done.reduce((s, l) => s + l.lap_duration, 0);
      const drv    = driverMap[num] || {};
      const dStints = (stintsByDrv[num] || []).sort((a, b) => a.stint_number - b.stint_number);
      const curS   = dStints.filter(s => (s.lap_start || 0) <= selLap).slice(-1)[0];
      const bestL  = done.reduce((b, l) => l.lap_duration < b ? l.lap_duration : b, Infinity);
      const lastL  = done[done.length - 1]?.lap_duration;

      return {
        num, code: drv.name_acronym || `#${num}`,
        fullName:  drv.full_name || "",
        teamColor: drv.team_colour ? `#${drv.team_colour}` : "#888",
        lapsCompleted: maxL, cumTime: cumT,
        lastLap: lastL, bestLap: bestL === Infinity ? null : bestL,
        compound: curS?.compound || stints[num]?.compound || "",
        tyreAge:  curS ? selLap - (curS.lap_start || 1) + 1 : null,
        stints:   dStints,
      };
    }).filter(Boolean)
      .filter(d => d.lapsCompleted > 0)
      .sort((a, b) => b.lapsCompleted - a.lapsCompleted || a.cumTime - b.cumTime);

    const ldrCum  = entries[0]?.cumTime   || 0;
    const ldrLaps = entries[0]?.lapsCompleted || 0;
    return entries.map((d, i) => ({
      ...d, position: i + 1,
      gap: i === 0 ? formatLap(d.cumTime)
        : d.lapsCompleted < ldrLaps ? `+${ldrLaps - d.lapsCompleted}L`
        : `+${(d.cumTime - ldrCum).toFixed(3)}s`,
    }));
  }, [allLaps, selLap, driverMap, stints, allStints]);

  // ── Derived: race events ──────────────────────────────────────────────────
  const raceEvents = useMemo(() => {
    if (!allLaps.length) return [];
    const events = [];

    const raceStartMs = allLaps
      .filter(l => l.lap_number === 1 && l.date_start)
      .reduce((mn, l) => Math.min(mn, Date.parse(l.date_start)), Infinity);

    const dateToLap = (dt) => {
      if (!dt || raceStartMs === Infinity) return null;
      const t = Date.parse(dt);
      for (const lap of allLaps) {
        if (!lap.date_start || !lap.lap_duration) continue;
        const ls = Date.parse(lap.date_start);
        if (t >= ls && t <= ls + lap.lap_duration * 1000) return lap.lap_number;
      }
      let best = null, bd = Infinity;
      for (const lap of allLaps) {
        if (!lap.date_start) continue;
        const d = Math.abs(Date.parse(lap.date_start) - t);
        if (d < bd) { bd = d; best = lap.lap_number; }
      }
      return best;
    };

    // Pit stops (from /pit endpoint — has actual durations)
    for (const pit of allPits) {
      const drv = driverMap[String(pit.driver_number)] || {};
      events.push({
        type:"pit", lap: pit.lap_number || 0,
        label: `${drv.name_acronym || "#"+pit.driver_number} pitted`,
        detail: pit.pit_duration ? `${pit.pit_duration.toFixed(1)}s stop` : "",
        driver: String(pit.driver_number),
      });
    }

    // Fastest lap
    const valid = allLaps.filter(l => l.lap_duration > 0 && l.lap_number > 3);
    if (valid.length) {
      const fl  = valid.reduce((b, l) => l.lap_duration < b.lap_duration ? l : b);
      const drv = driverMap[String(fl.driver_number)] || {};
      events.push({
        type:"fastest", lap: fl.lap_number,
        label: `${drv.name_acronym || "#"+fl.driver_number} fastest lap`,
        detail: formatLap(fl.lap_duration),
        driver: String(fl.driver_number),
      });
    }

    // DNFs (from timeline — driver retired before max lap)
    for (const driver of Object.values(stateRef.current.drivers)) {
      if (driver.isRetired) {
        events.push({
          type:"dnf", lap: driver.retiredLap,
          label: `${driver.code} retired`,
          detail: `Lap ${driver.retiredLap}`,
          driver: driver.num,
        });
      }
    }

    // SC / VSC / flags from race_control
    const seen = new Set();
    for (const rc of raceCtrl) {
      const msg = (rc.message || "").toUpperCase();
      const cat = (rc.category || "").toUpperCase();
      const lap = dateToLap(rc.date);
      if (lap == null) continue;
      if ((cat === "SAFETYCAR" || msg.includes("SAFETY CAR")) && msg.includes("DEPLOYED")) {
        const k = `sc-${lap}`;
        if (!seen.has(k)) { seen.add(k); events.push({ type:"sc", lap, label:"Safety Car deployed", detail:`Lap ${lap}` }); }
      } else if (msg.includes("VIRTUAL SAFETY CAR") && (msg.includes("DEPLOYED") || msg.includes("PERIOD"))) {
        const k = `vsc-${lap}`;
        if (!seen.has(k)) { seen.add(k); events.push({ type:"vsc", lap, label:"Virtual Safety Car", detail:`Lap ${lap}` }); }
      } else if (cat === "FLAG" && msg.includes("RED")) {
        events.push({ type:"flag", lap, label:"Red Flag", detail:`Lap ${lap}` });
      }
    }

    return events.sort((a, b) => (a.lap||0) - (b.lap||0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLaps, allPits, raceCtrl, driverMap]);

  // ── Derived: current weather ──────────────────────────────────────────────
  const weather = useMemo(() => {
    if (!wxData.length) return null;
    const raceStartMs = allLaps
      .filter(l => l.lap_number === 1 && l.date_start)
      .reduce((mn, l) => Math.min(mn, Date.parse(l.date_start)), Infinity);
    if (raceStartMs === Infinity) return wxData[0];
    const target = raceStartMs + raceTime * 1000;
    let best = wxData[0], bd = Infinity;
    for (const w of wxData) {
      if (!w.date) continue;
      const d = Math.abs(Date.parse(w.date) - target);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }, [wxData, raceTime, allLaps]);

  // ── Render ────────────────────────────────────────────────────────────────
  const isLoading = loadStage !== null;
  const lapPct    = totalLaps > 0 ? (selLap / totalLaps) * 100 : 0;

  if (initLoading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      minHeight:400, color:"#222", fontFamily:"monospace", fontSize:"0.8rem" }}>
      Loading schedule...
    </div>
  );

  if (!allRaces.length) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      minHeight:400, color:"#222", fontFamily:"monospace", fontSize:"0.8rem" }}>
      No completed 2026 races yet.
    </div>
  );

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">

      {/* ── Race selector ── */}
      <div style={{ marginBottom:"1.25rem" }}>
        <SectionLabel>Race Replay</SectionLabel>
        <div style={{ display:"flex", gap:"0.35rem", flexWrap:"wrap" }}>
          {allRaces.map(race => {
            const active = selectedRace?.round === race.round;
            const flag   = COUNTRY_FLAGS[race.Circuit.Location.country] || "🏁";
            return (
              <motion.button key={race.round}
                whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
                onClick={() => !isLoading && setSelectedRace(race)}
                disabled={isLoading}
                style={{
                  background: active ? "rgba(225,6,0,0.16)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? accent+"77" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#fff" : "#444",
                  padding:"0.3rem 0.6rem", borderRadius:6,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  fontSize:"0.71rem", fontFamily:"inherit", whiteSpace:"nowrap",
                  opacity: isLoading && !active ? 0.4 : 1,
                }}>
                {flag} {race.raceName.replace(" Grand Prix","")}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Loading screen ── */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{
              background:"#080810", border:`1px solid rgba(225,6,0,0.15)`,
              borderRadius:16, overflow:"hidden", marginBottom:"1.5rem",
            }}>
            {/* Circuit trace canvas */}
            <div style={{ position:"relative", background:"#050508" }}>
              <canvas ref={loadCvsRef} width={CW} height={220}
                style={{ width:"100%", display:"block", opacity:0.85 }} />
              {/* Race info overlay */}
              <div style={{
                position:"absolute", inset:0,
                display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center",
                pointerEvents:"none",
              }}>
                <div style={{ fontSize:"0.6rem", fontFamily:"monospace", color:accent,
                  letterSpacing:"0.25em", marginBottom:"0.4rem" }}>
                  {selectedRace?.Circuit?.Location?.country?.toUpperCase()} · ROUND {selectedRace?.round}
                </div>
                <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#fff", letterSpacing:"0.06em" }}>
                  {selectedRace?.raceName?.replace(" Grand Prix","").toUpperCase()}
                  <span style={{ color:accent }}> GP</span>
                </div>
                <div style={{ fontSize:"0.58rem", color:"#333", fontFamily:"monospace", marginTop:"0.3rem" }}>
                  {selectedRace?.Circuit?.circuitName}
                </div>
              </div>
            </div>

            {/* Progress */}
            <div style={{ padding:"1.25rem 1.75rem 1.5rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:"0.7rem", fontFamily:"monospace", color:"#ccc" }}>{loadStage}</span>
                <span style={{ fontSize:"0.7rem", fontFamily:"monospace", color:"#444" }}>{loadPct}%</span>
              </div>
              <div style={{ height:3, background:"rgba(255,255,255,0.05)", borderRadius:99, overflow:"hidden" }}>
                <motion.div animate={{ width:`${loadPct}%` }} transition={{ duration:0.5 }}
                  style={{ height:"100%", background:`linear-gradient(90deg,${accent},#ff6b35)`, borderRadius:99 }} />
              </div>
              <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginTop:"0.9rem", justifyContent:"center" }}>
                {STAGES.map((s, i) => {
                  const done = loadPct >= s.pct;
                  const cur  = loadStage === s.label;
                  return (
                    <span key={i} style={{
                      fontSize:"0.57rem", fontFamily:"monospace",
                      color: done ? "#00e472" : cur ? accent : "#1e1e2e",
                      transition:"color 0.3s",
                    }}>
                      {done ? "✓" : cur ? "●" : "·"} {s.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ background:"rgba(225,6,0,0.06)", border:`1px solid ${accent}33`,
              borderRadius:10, padding:"0.85rem 1.25rem", marginBottom:"1.5rem" }}>
            <span style={{ fontSize:"0.8rem", color:"#f0a0a0" }}>⚠ {error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main replay layout ── */}
      {dataReady && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 310px", gap:"1.25rem", alignItems:"start" }}>

          {/* ── Left: canvas + controls ── */}
          <div>
            {/* Canvas panel */}
            <div style={{
              position:"relative", background:"#080810",
              border:"1px solid rgba(255,255,255,0.06)",
              borderRadius:14, overflow:"hidden",
              boxShadow:"0 16px 64px rgba(0,0,0,0.85)",
              marginBottom:"0.75rem",
            }}>
              <canvas ref={canvasRef} width={CW} height={CH}
                style={{ width:"100%", display:"block" }} />

              {/* Top-left: race/lap info */}
              <div style={{
                position:"absolute", top:12, left:12,
                background:"rgba(6,6,14,0.88)", backdropFilter:"blur(10px)",
                border:"1px solid rgba(255,255,255,0.07)", borderRadius:9,
                padding:"0.45rem 0.8rem",
              }}>
                <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#fff", letterSpacing:"0.04em" }}>
                  {selectedRace?.raceName?.replace(" Grand Prix","")}
                  <span style={{ color:accent }}> GP</span>
                </div>
                <div style={{ fontSize:"0.6rem", color:"#444", fontFamily:"monospace", marginTop:2 }}>
                  Lap <span style={{ color:"#bbb" }}>{selLap}</span>
                  <span style={{ color:"#2a2a3a" }}> / {totalLaps}</span>
                  <span style={{ color:"#333", marginLeft:"0.5rem" }}>{fmtTime(raceTime)}</span>
                </div>
              </div>

              {/* Top-right: weather widget */}
              {weather && (
                <div style={{
                  position:"absolute", top:12, right:12,
                  background:"rgba(6,6,14,0.88)", backdropFilter:"blur(10px)",
                  border:"1px solid rgba(255,255,255,0.07)", borderRadius:9,
                  padding:"0.45rem 0.8rem",
                  fontSize:"0.62rem", fontFamily:"monospace",
                }}>
                  <div style={{ color:"#888", fontSize:"0.55rem", letterSpacing:"0.1em", marginBottom:3 }}>
                    {weather.rainfall > 0 ? "🌧 RAIN" : "☀ DRY CONDITIONS"}
                  </div>
                  <div style={{ display:"flex", gap:"0.75rem" }}>
                    {weather.track_temperature != null && (
                      <span>Track <span style={{ color:"#e8702a" }}>{Math.round(weather.track_temperature)}°</span></span>
                    )}
                    {weather.air_temperature != null && (
                      <span>Air <span style={{ color:"#aaa" }}>{Math.round(weather.air_temperature)}°</span></span>
                    )}
                    {weather.wind_speed != null && (
                      <span>Wind <span style={{ color:"#777" }}>{weather.wind_speed}km/h</span></span>
                    )}
                  </div>
                </div>
              )}

              {/* Selected driver indicator */}
              {selDriver && stateRef.current.drivers[selDriver] && (
                <div style={{
                  position:"absolute", bottom:16, left:12,
                  background:"rgba(6,6,14,0.92)", backdropFilter:"blur(10px)",
                  border:`1px solid ${stateRef.current.drivers[selDriver].color}44`,
                  borderLeft:`3px solid ${stateRef.current.drivers[selDriver].color}`,
                  borderRadius:9, padding:"0.4rem 0.7rem",
                  display:"flex", alignItems:"center", gap:"0.5rem",
                }}>
                  <span style={{ fontSize:"0.8rem", fontWeight:700, color:stateRef.current.drivers[selDriver].color }}>
                    {stateRef.current.drivers[selDriver].code}
                  </span>
                  <span style={{ fontSize:"0.6rem", color:"#555", fontFamily:"monospace" }}>
                    following
                  </span>
                  <span
                    onClick={() => setSelDriver(null)}
                    style={{ fontSize:"0.65rem", color:"#333", cursor:"pointer", marginLeft:4 }}>✕</span>
                </div>
              )}

              {/* Lap progress bar */}
              <div style={{ height:2, background:"rgba(255,255,255,0.04)" }}>
                <motion.div animate={{ width:`${lapPct}%` }} transition={{ duration:0.12 }}
                  style={{ height:"100%", background:`linear-gradient(90deg,${accent},#ff6b35)` }} />
              </div>
            </div>

            {/* Playback controls */}
            <div style={{
              background:"rgba(6,6,12,0.97)", border:"1px solid rgba(255,255,255,0.06)",
              borderRadius:12, padding:"0.9rem 1.1rem", backdropFilter:"blur(16px)",
            }}>
              {/* Row 1: play/reset/time/speed */}
              <div style={{ display:"flex", alignItems:"center", gap:"0.65rem", marginBottom:"0.7rem" }}>
                <motion.button whileTap={{ scale:0.88 }} onClick={playToggle} style={{
                  width:40, height:40, borderRadius:"50%", border:"none", flexShrink:0,
                  background: isPlaying
                    ? "linear-gradient(135deg,#f5c518,#d4a800)"
                    : `linear-gradient(135deg,${accent},#c20000)`,
                  color:"#fff", fontWeight:900, fontSize:"1rem", cursor:"pointer",
                  boxShadow: isPlaying ? "0 0 20px #f5c51840" : `0 0 20px ${accent}40`,
                }}>{isPlaying ? "⏸" : "▶"}</motion.button>

                <motion.button whileTap={{ scale:0.9 }} onClick={reset}
                  title="Reset to start" style={{
                    width:30, height:30, borderRadius:"50%", flexShrink:0,
                    border:"1px solid rgba(255,255,255,0.07)", background:"transparent",
                    color:"#444", cursor:"pointer", fontSize:"0.9rem",
                  }}>↺</motion.button>

                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"0.9rem", fontFamily:"monospace", fontVariantNumeric:"tabular-nums", color:"#eee" }}>
                    {fmtTime(raceTime)}
                    <span style={{ fontSize:"0.6rem", color:"#2a2a3a", margin:"0 0.3rem" }}>/</span>
                    <span style={{ fontSize:"0.62rem", color:"#333" }}>{fmtTime(stateRef.current.maxTime)}</span>
                  </div>
                  <div style={{ fontSize:"0.57rem", color:"#2a2a3a", fontFamily:"monospace" }}>
                    space to play · click driver to follow
                  </div>
                </div>

                {/* Speed buttons */}
                <div style={{ display:"flex", gap:2, flexShrink:0 }}>
                  {[0.25,0.5,1,2,4,8,16].map(s => (
                    <motion.button key={s} whileTap={{ scale:0.9 }}
                      onClick={() => setSpeed(s)} style={{
                        background: speed===s ? "rgba(225,6,0,0.18)" : "transparent",
                        border:`1px solid ${speed===s ? accent+"66" : "rgba(255,255,255,0.06)"}`,
                        color: speed===s ? accent : "#333",
                        padding:"0.18rem 0.36rem", borderRadius:5, cursor:"pointer",
                        fontSize:"0.58rem", fontFamily:"monospace", fontWeight:700,
                      }}>{s}×</motion.button>
                  ))}
                </div>
              </div>

              {/* Timeline scrubber with event dots above */}
              <div style={{ position:"relative", paddingTop:10 }}>
                {/* Event markers */}
                {raceEvents.map((ev, i) => {
                  if (!ev.lap || !totalLaps) return null;
                  const pct = ((ev.lap - 0.5) / totalLaps) * 100;
                  const es  = EV[ev.type];
                  return (
                    <div key={i} title={`L${ev.lap}: ${ev.label}`} style={{
                      position:"absolute", top:0,
                      left:`${pct}%`, transform:"translateX(-50%)",
                      width:5, height:5, borderRadius:"50%",
                      background: es?.color || "#666",
                      cursor:"pointer", zIndex:1,
                      boxShadow: `0 0 4px ${es?.color || "#666"}`,
                    }} onClick={() => scrub(ev.lap)} />
                  );
                })}
                <input type="range" min={1} max={totalLaps||1} step={1}
                  value={selLap} onChange={e => scrub(e.target.value)}
                  style={{ width:"100%", cursor:"pointer" }} />
                <div style={{ display:"flex", justifyContent:"space-between",
                  fontSize:"0.57rem", color:"#1e1e2e", fontFamily:"monospace", marginTop:"0.15rem" }}>
                  <span>L1</span>
                  <span style={{ color:accent }}>L{selLap} · {fmtTime(raceTime)}</span>
                  <span>L{totalLaps}</span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div style={{
              display:"flex", gap:"1rem", flexWrap:"wrap",
              padding:"0.4rem 0.6rem", marginTop:"0.5rem",
              background:"rgba(6,6,12,0.6)", borderRadius:8,
              border:"1px solid rgba(255,255,255,0.03)",
              fontSize:"0.56rem", color:"#2a2a3a", fontFamily:"monospace",
            }}>
              <span>● Estimated position from lap timing — not real GPS</span>
              <span style={{ color:"#1a1a2e" }}>·· = within ~1s (battle)</span>
              <span>
                {Object.keys(EV).map(k => (
                  <span key={k} style={{ color:EV[k].color, marginRight:"0.4rem" }}>
                    ● {EV[k].label}
                  </span>
                ))}
              </span>
            </div>
          </div>

          {/* ── Right: leaderboard + events ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>

            {/* Live leaderboard */}
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"0.5rem" }}>
                <SectionLabel>Leaderboard</SectionLabel>
                <span style={{ fontSize:"0.57rem", color:"#222", fontFamily:"monospace" }}>L{selLap}</span>
              </div>
              <div style={{ maxHeight:460, overflowY:"auto" }}>
                <motion.div layout>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {leaderboard.map((d, i) => {
                      const tc  = TYRE[d.compound] || { color:"#333", label:"?" };
                      const pos = i===0 ? accent : i===1 ? "#b0b0b0" : i===2 ? "#a07040" : "#333";
                      const isSel = selDriver === d.num;
                      return (
                        <motion.div key={d.num} layout="position"
                          initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:12 }}
                          transition={{ layout:{ duration:0.28 }, duration:0.18 }}
                          onClick={() => setSelDriver(isSel ? null : d.num)}
                          style={{
                            display:"flex", alignItems:"center", gap:"0.35rem",
                            padding:"0.42rem 0.55rem", marginBottom:2, borderRadius:6,
                            background: isSel ? `${d.teamColor}14` : i%2===0 ? "rgba(12,12,22,0.95)" : "rgba(9,9,18,0.95)",
                            borderLeft:`3px solid ${d.teamColor}`,
                            border: isSel ? `1px solid ${d.teamColor}33` : "1px solid transparent",
                            cursor:"pointer",
                          }}>
                          <span style={{ fontFamily:"monospace", fontSize:"0.72rem", width:16,
                            flexShrink:0, color:pos, fontWeight:700 }}>
                            {d.position}
                          </span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:"0.28rem" }}>
                              <span style={{ fontWeight:700, fontSize:"0.76rem", color:d.teamColor }}>{d.code}</span>
                              {/* Tyre compound badge */}
                              <span style={{
                                width:12, height:12, borderRadius:"50%", flexShrink:0,
                                background:tc.color, border:"1.5px solid rgba(255,255,255,0.18)",
                                display:"flex", alignItems:"center", justifyContent:"center",
                              }} title={d.compound} />
                              {d.tyreAge && (
                                <span style={{ fontSize:"0.52rem", color:"#2a2a3a", fontFamily:"monospace" }}>
                                  {d.tyreAge}L
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize:"0.56rem", color:"#2a2a3a", fontFamily:"monospace",
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {d.fullName.split(" ").slice(-1)[0]}
                            </div>
                          </div>
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            <div style={{ fontSize:"0.63rem", fontFamily:"monospace", color:i===0?"#00e472":"#444" }}>
                              {d.gap}
                            </div>
                            {d.lastLap && (
                              <div style={{
                                fontSize:"0.57rem", fontFamily:"monospace",
                                color: d.bestLap && d.lastLap <= d.bestLap * 1.001 ? "#cc88ff" : "#2a2a3a",
                              }}>
                                {formatLap(d.lastLap)}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              </div>
            </div>

            {/* Race events feed */}
            {raceEvents.length > 0 && (
              <div>
                <SectionLabel>Race Events</SectionLabel>
                <div style={{
                  height:200, overflowY:"auto",
                  background:"#0b0b18", border:"1px solid #1a1a2e",
                  borderRadius:8, padding:"0.35rem",
                }}>
                  {raceEvents.map((ev, i) => {
                    const state = ev.lap < selLap - 1 ? "past"
                                : ev.lap <= selLap + 1 ? "current"
                                : "future";
                    const es = EV[ev.type] || EV.pit;
                    return (
                      <motion.div key={i}
                        animate={{ opacity: state==="future" ? 0.28 : state==="past" ? 0.5 : 1 }}
                        style={{
                          display:"flex", gap:"0.4rem",
                          padding:"0.3rem 0.45rem", marginBottom:3, borderRadius:5,
                          background:"#131328",
                          border: state==="current" ? `1px solid ${es.color}44` : "1px solid #1e1e35",
                          borderLeft: state==="current" ? `3px solid ${es.color}` : "1px solid #1e1e35",
                          boxShadow: state==="current" ? `0 0 10px ${es.color}28` : "none",
                        }}>
                        <span style={{ fontSize:"0.57rem", fontFamily:"monospace",
                          color:"#444", width:22, flexShrink:0, paddingTop:"0.15rem" }}>
                          L{ev.lap}
                        </span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <span style={{
                            display:"inline-block", marginBottom:"0.14rem",
                            fontSize:"0.52rem", fontWeight:700, fontFamily:"monospace",
                            color:es.color, background:es.bg,
                            border:`1px solid ${es.color}77`,
                            borderRadius:3, padding:"0.04rem 0.24rem",
                          }}>{es.label}</span>
                          <div style={{ fontSize:"0.67rem", color:"#ddd", fontWeight:600,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {ev.label}
                          </div>
                          {ev.detail && (
                            <div style={{ fontSize:"0.56rem", color:"#444", fontFamily:"monospace" }}>
                              {ev.detail}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ergast fallback when no lap-by-lap data */}
            {!leaderboard.length && ergRes.length > 0 && (
              <div>
                <SectionLabel>Official Result</SectionLabel>
                {ergRes.slice(0, 12).map((r, i) => (
                  <div key={i} style={{
                    display:"flex", alignItems:"center", gap:"0.5rem",
                    padding:"0.42rem 0.6rem", marginBottom:2, borderRadius:6,
                    background: i%2===0 ? "rgba(12,12,22,0.95)" : "rgba(9,9,18,0.95)",
                  }}>
                    <span style={{ fontFamily:"monospace", fontSize:"0.72rem", width:18, flexShrink:0,
                      color: i<3 ? [accent,"#b0b0b0","#a07040"][i] : "#333", fontWeight:700 }}>
                      {r.position}
                    </span>
                    <span style={{ flex:1, fontSize:"0.76rem", color:"#bbb" }}>
                      {r.Driver.givenName[0]}. {r.Driver.familyName}
                    </span>
                    <span style={{ fontSize:"0.65rem", fontFamily:"monospace", color:"#444" }}>
                      {i===0 ? (r.Time?.time || "—") : r.Time?.time ? `+${r.Time.time}` : r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
