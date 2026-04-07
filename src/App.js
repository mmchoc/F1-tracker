import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const TOTAL_ROUNDS = 24;
const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const COMPLETED_ROUNDS = 1;
const REMAINING_ROUNDS = TOTAL_ROUNDS - COMPLETED_ROUNDS;

const DRIVER_IMAGES = {
  RUS: "https://www.formula1.com/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png",
  ANT: "https://www.formula1.com/content/dam/fom-website/drivers/K/KIMANT01_Kimi_Antonelli/kimant01.png",
  LEC: "https://www.formula1.com/content/dam/fom-website/drivers/C/CHALEC16_Charles_Leclerc/chalec16.png",
  HAM: "https://www.formula1.com/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png",
  NOR: "https://www.formula1.com/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png",
  VER: "https://www.formula1.com/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png",
  PIA: "https://www.formula1.com/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png",
  SAI: "https://www.formula1.com/content/dam/fom-website/drivers/C/CARSAI55_Carlos_Sainz/carsai55.png",
  ALB: "https://www.formula1.com/content/dam/fom-website/drivers/A/ALEALB23_Alexander_Albon/alealb23.png",
  GAS: "https://www.formula1.com/content/dam/fom-website/drivers/P/PIEGAS10_Pierre_Gasly/piegas10.png",
  ALO: "https://www.formula1.com/content/dam/fom-website/drivers/F/FERALO14_Fernando_Alonso/feralo14.png",
  STR: "https://www.formula1.com/content/dam/fom-website/drivers/L/LANSTR18_Lance_Stroll/lanstr18.png",
  HUL: "https://www.formula1.com/content/dam/fom-website/drivers/N/NICHUL27_Nico_Hulkenberg/nichul27.png",
  BEA: "https://www.formula1.com/content/dam/fom-website/drivers/O/OLIBEA38_Oliver_Bearman/olibea38.png",
  HAD: "https://www.formula1.com/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png",
  LIN: "https://www.formula1.com/content/dam/fom-website/drivers/A/ARVLIN01_Arvid_Lindblad/arvlin01.png",
  BOR: "https://www.formula1.com/content/dam/fom-website/drivers/G/GABBOR01_Gabriel_Bortoleto/gabbor01.png",
  COL: "https://www.formula1.com/content/dam/fom-website/drivers/F/FRACOL43_Franco_Colapinto/fracol43.png",
  LAW: "https://www.formula1.com/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png",
};

const COUNTRY_FLAGS = {
  Australia: "🇦🇺", China: "🇨🇳", Japan: "🇯🇵", Bahrain: "🇧🇭",
  "Saudi Arabia": "🇸🇦", USA: "🇺🇸", Canada: "🇨🇦", Monaco: "🇲🇨",
  Spain: "🇪🇸", Austria: "🇦🇹", UK: "🇬🇧", Belgium: "🇧🇪",
  Hungary: "🇭🇺", Netherlands: "🇳🇱", Italy: "🇮🇹", Azerbaijan: "🇦🇿",
  Singapore: "🇸🇬", Mexico: "🇲🇽", Brazil: "🇧🇷", Qatar: "🇶🇦", UAE: "🇦🇪",
};

const initialDrivers = [
  { id: "RUS", name: "George Russell",    team: "Mercedes",      pts: 25, color: "#00D2BE", nationality: "🇬🇧",
    ratings: { pace: 90, consistency: 88, racecraft: 85, qualifying: 92, wet: 82 }, raceHistory: [25] },
  { id: "ANT", name: "Kimi Antonelli",    team: "Mercedes",      pts: 18, color: "#00D2BE", nationality: "🇮🇹",
    ratings: { pace: 86, consistency: 80, racecraft: 84, qualifying: 85, wet: 78 }, raceHistory: [18] },
  { id: "LEC", name: "Charles Leclerc",   team: "Ferrari",       pts: 15, color: "#DC143C", nationality: "🇲🇨",
    ratings: { pace: 91, consistency: 83, racecraft: 86, qualifying: 94, wet: 81 }, raceHistory: [15] },
  { id: "HAM", name: "Lewis Hamilton",    team: "Ferrari",       pts: 12, color: "#DC143C", nationality: "🇬🇧",
    ratings: { pace: 88, consistency: 85, racecraft: 93, qualifying: 88, wet: 92 }, raceHistory: [12] },
  { id: "NOR", name: "Lando Norris",      team: "McLaren",       pts: 10, color: "#FF8000", nationality: "🇬🇧",
    ratings: { pace: 92, consistency: 86, racecraft: 87, qualifying: 90, wet: 88 }, raceHistory: [10] },
  { id: "VER", name: "Max Verstappen",    team: "Red Bull",      pts: 8,  color: "#1E41FF", nationality: "🇳🇱",
    ratings: { pace: 95, consistency: 87, racecraft: 95, qualifying: 93, wet: 95 }, raceHistory: [8] },
  { id: "BEA", name: "Oliver Bearman",    team: "Haas",          pts: 6,  color: "#FFFFFF", nationality: "🇬🇧",
    ratings: { pace: 78, consistency: 75, racecraft: 79, qualifying: 76, wet: 72 }, raceHistory: [6] },
  { id: "LIN", name: "Arvid Lindblad",    team: "Racing Bulls",  pts: 4,  color: "#6692FF", nationality: "🇸🇪",
    ratings: { pace: 76, consistency: 73, racecraft: 74, qualifying: 75, wet: 70 }, raceHistory: [4] },
  { id: "BOR", name: "Gabriel Bortoleto", team: "Audi",          pts: 2,  color: "#e8091e", nationality: "🇧🇷",
    ratings: { pace: 75, consistency: 72, racecraft: 76, qualifying: 74, wet: 71 }, raceHistory: [2] },
  { id: "GAS", name: "Pierre Gasly",      team: "Alpine",        pts: 1,  color: "#0090FF", nationality: "🇫🇷",
    ratings: { pace: 80, consistency: 78, racecraft: 81, qualifying: 79, wet: 80 }, raceHistory: [1] },
  { id: "HAD", name: "Isack Hadjar",      team: "Red Bull",      pts: 0,  color: "#1E41FF", nationality: "🇫🇷",
    ratings: { pace: 78, consistency: 76, racecraft: 77, qualifying: 78, wet: 74 }, raceHistory: [0] },
  { id: "LAW", name: "Liam Lawson",       team: "RB F1 Team",    pts: 0,  color: "#6692FF", nationality: "🇳🇿",
    ratings: { pace: 79, consistency: 77, racecraft: 78, qualifying: 77, wet: 75 }, raceHistory: [0] },
  { id: "SAI", name: "Carlos Sainz",      team: "Williams",      pts: 0,  color: "#64C4FF", nationality: "🇪🇸",
    ratings: { pace: 85, consistency: 84, racecraft: 86, qualifying: 85, wet: 83 }, raceHistory: [0] },
  { id: "ALB", name: "Alex Albon",        team: "Williams",      pts: 0,  color: "#64C4FF", nationality: "🇹🇭",
    ratings: { pace: 80, consistency: 81, racecraft: 82, qualifying: 79, wet: 78 }, raceHistory: [0] },
  { id: "PIA", name: "Oscar Piastri",     team: "McLaren",       pts: 0,  color: "#FF8000", nationality: "🇦🇺",
    ratings: { pace: 88, consistency: 85, racecraft: 84, qualifying: 87, wet: 82 }, raceHistory: [0] },
  { id: "HUL", name: "Nico Hulkenberg",   team: "Haas",          pts: 0,  color: "#FFFFFF", nationality: "🇩🇪",
    ratings: { pace: 79, consistency: 80, racecraft: 79, qualifying: 80, wet: 77 }, raceHistory: [0] },
  { id: "COL", name: "Franco Colapinto",  team: "Alpine",        pts: 0,  color: "#0090FF", nationality: "🇦🇷",
    ratings: { pace: 77, consistency: 75, racecraft: 76, qualifying: 76, wet: 73 }, raceHistory: [0] },
  { id: "ALO", name: "Fernando Alonso",   team: "Aston Martin",  pts: 0,  color: "#006F62", nationality: "🇪🇸",
    ratings: { pace: 84, consistency: 83, racecraft: 90, qualifying: 82, wet: 88 }, raceHistory: [0] },
  { id: "STR", name: "Lance Stroll",      team: "Aston Martin",  pts: 0,  color: "#006F62", nationality: "🇨🇦",
    ratings: { pace: 76, consistency: 75, racecraft: 75, qualifying: 74, wet: 74 }, raceHistory: [0] },
];

const initialConstructors = [
  { id: "MER", name: "Mercedes",     pts: 43, color: "#00D2BE", drivers: ["RUS","ANT"] },
  { id: "FER", name: "Ferrari",      pts: 27, color: "#DC143C", drivers: ["LEC","HAM"] },
  { id: "MCL", name: "McLaren",      pts: 10, color: "#FF8000", drivers: ["NOR","PIA"] },
  { id: "RBR", name: "Red Bull",     pts: 8,  color: "#1E41FF", drivers: ["VER","HAD"] },
  { id: "HAS", name: "Haas",         pts: 6,  color: "#FFFFFF", drivers: ["BEA","HUL"] },
  { id: "VCR", name: "Racing Bulls", pts: 4,  color: "#6692FF", drivers: ["LIN","LAW"] },
  { id: "AUD", name: "Audi",         pts: 2,  color: "#e8091e", drivers: ["BOR"] },
  { id: "ALP", name: "Alpine",       pts: 1,  color: "#0090FF", drivers: ["GAS","COL"] },
];

function predictChampionship(driverList) {
  return driverList.map(d => {
    const carFactor = { Mercedes: 1.18, Ferrari: 1.08, McLaren: 1.06, "Red Bull": 1.04 }[d.team] ?? 0.90;
    const avgRating = Object.values(d.ratings).reduce((a,b) => a+b,0) / Object.keys(d.ratings).length;
    const ratePerRace = d.pts / COMPLETED_ROUNDS;
    const projectedPts = Math.round(d.pts + (ratePerRace * carFactor * (avgRating/90) * REMAINING_ROUNDS));
    const confidence = Math.min(99, Math.round((projectedPts / (TOTAL_ROUNDS * 22)) * 100 * (avgRating/90)));
    return { ...d, projectedPts, confidence };
  }).sort((a,b) => b.projectedPts - a.projectedPts);
}

function predictRaceWinner(race, driverList) {
  return driverList.slice(0,6).map(d => {
    const isFav = (race.favorites || []).includes(d.id);
    const base = (d.ratings.pace * 0.35 + d.ratings.qualifying * 0.25 + d.ratings.racecraft * 0.25 + d.ratings.consistency * 0.15);
    const boost = isFav ? 8 : 0;
    const carBoost = { Mercedes: 12, Ferrari: 7, McLaren: 5, "Red Bull": 4 }[d.team] ?? 0;
    const rawScore = base + boost + carBoost + Math.random() * 3;
    return { ...d, rawScore };
  }).sort((a,b) => b.rawScore - a.rawScore).map((d, i) => ({
    ...d,
    winPct: Math.max(2, Math.round([38,22,15,10,8,5,2][i] * ((d.rawScore/110))))
  }));
}

const bg = "#0a0a0f";
const card = "#12121a";
const border = "#1f1f2e";
const accent = "#e10600";
const text = "#f0ece3";
const muted = "#666";

const Tab = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    background: active ? accent : "transparent",
    border: `1px solid ${active ? accent : border}`,
    color: active ? "#fff" : muted,
    padding: "0.45rem 1rem", borderRadius: 6, cursor: "pointer",
    fontSize: "0.8rem", fontFamily: "'Georgia', serif",
    letterSpacing: "0.05em", transition: "all 0.2s", whiteSpace: "nowrap",
  }}>{label}</button>
);

const Card = ({ children, style }) => (
  <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: "1.25rem", ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: "1rem", fontFamily: "monospace" }}>
    {children}
  </div>
);

const DriverAvatar = ({ driverId, name, size = 40 }) => {
  const [imgError, setImgError] = useState(false);
  const imgUrl = DRIVER_IMAGES[driverId];
  const initials = name ? name.split(" ").map(n => n[0]).join("").slice(0,2) : driverId?.slice(0,2) || "??";

  if (!imgUrl || imgError) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "#1f1f2e", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, fontWeight: 700, color: muted, flexShrink: 0,
      }}>{initials}</div>
    );
  }

  return (
    <img
      src={imgUrl}
      alt={name}
      onError={() => setImgError(true)}
      referrerPolicy="no-referrer"
      style={{
        width: size, height: size, borderRadius: "50%",
        objectFit: "cover", objectPosition: "top",
        background: "#1f1f2e", flexShrink: 0,
      }}
    />
  );
};

// ─── LIVE TIMING TAB ──────────────────────────────────────────────────────────

function LiveTimingTab() {
  const ERGAST = "https://api.jolpi.ca/ergast/f1";
  const OF1    = "https://api.openf1.org/v1";
  const SVG_W  = 320, SVG_H = 210, PAD = 14;

  // ── State ──────────────────────────────────────────────────────────────────
  const [allRaces,      setAllRaces]      = useState([]);
  const [of1Sessions,   setOf1Sessions]   = useState([]);
  const [selectedRace,  setSelectedRace]  = useState(null);
  const [sessionData,   setSessionData]   = useState(null);
  const [isLive,        setIsLive]        = useState(false);
  const [loadingInit,   setLoadingInit]   = useState(true);
  const [loadingData,   setLoadingData]   = useState(false);

  const [ergastResults, setErgastResults] = useState([]);
  const [of1Drivers,    setOf1Drivers]    = useState({});
  const [stints,        setStints]        = useState({});
  const [lapTimes,      setLapTimes]      = useState({});

  const [livePositions, setLivePositions] = useState({});
  const [liveIntervals, setLiveIntervals] = useState({});
  const [raceControl,   setRaceControl]   = useState([]);

  // Circuit map
  const [trackPath,     setTrackPath]     = useState([]);
  const [trackBounds,   setTrackBounds]   = useState(null);
  const [driverDots,    setDriverDots]    = useState({});

  // Replay
  const [allLapsRaw,  setAllLapsRaw]  = useState([]);
  const [maxLaps,     setMaxLaps]     = useState(0);
  const [replayLap,   setReplayLap]   = useState(1);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [locSnaps,    setLocSnaps]    = useState({});   // lap# → {driverNum → {x,y}}
  const [loadingSnap, setLoadingSnap] = useState(false);
  const [showReplay,  setShowReplay]  = useState(false);

  // ── Effect 1: load schedule ────────────────────────────────────────────────
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

  // ── Effect 2: match race to OpenF1 session ─────────────────────────────────
  useEffect(() => {
    if (!selectedRace || !of1Sessions.length) return;
    const locality = selectedRace.Circuit.Location.locality.toLowerCase();
    const country  = selectedRace.Circuit.Location.country.toLowerCase();
    const match = of1Sessions.find(s => s.location?.toLowerCase() === locality)
               || of1Sessions.find(s => s.country_name?.toLowerCase() === country);
    if (!match) return;
    setSessionData(match);
    const now = Date.now();
    setIsLive(now >= new Date(match.date_start).getTime() && now <= new Date(match.date_end).getTime());
    setErgastResults([]); setOf1Drivers({}); setStints({}); setLapTimes({});
    setLivePositions({}); setLiveIntervals({}); setRaceControl([]);
    setTrackPath([]); setTrackBounds(null); setDriverDots({});
    setAllLapsRaw([]); setMaxLaps(0); setReplayLap(1);
    setLocSnaps({}); setShowReplay(false); setIsReplaying(false);
  }, [selectedRace, of1Sessions]);

  // ── Effect 3: load race data ───────────────────────────────────────────────
  useEffect(() => {
    if (!sessionData || !selectedRace) return;
    let dead = false;
    setLoadingData(true);
    const sk    = sessionData.session_key;
    const round = selectedRace.round;

    (async () => {
      try {
        const [ergR, drvR, stR, lapR] = await Promise.all([
          fetch(`${ERGAST}/2026/${round}/results.json`).then(r => r.json()),
          fetch(`${OF1}/drivers?session_key=${sk}`).then(r => r.json()),
          fetch(`${OF1}/stints?session_key=${sk}`).then(r => r.json()),
          fetch(`${OF1}/laps?session_key=${sk}`).then(r => r.json()),
        ]);
        if (dead) return;

        const results = ergR?.MRData?.RaceTable?.Races?.[0]?.Results || [];
        setErgastResults(results);

        const drvsArr = Array.isArray(drvR) ? drvR : [];
        const drvsMap = {};
        drvsArr.forEach(d => { drvsMap[String(d.driver_number)] = d; });
        setOf1Drivers(drvsMap);

        const stMap = {};
        (Array.isArray(stR) ? stR : []).forEach(s => {
          const k = String(s.driver_number);
          if (!stMap[k] || s.stint_number > stMap[k].stint_number) stMap[k] = s;
        });
        setStints(stMap);

        // Store ALL laps (needed for replay) + latest per driver
        const allL = Array.isArray(lapR) ? lapR : [];
        setAllLapsRaw(allL);
        const lapMap = {};
        allL.forEach(l => {
          const k = String(l.driver_number);
          if (l.lap_duration && (!lapMap[k] || l.lap_number > lapMap[k].lap_number)) lapMap[k] = l;
        });
        setLapTimes(lapMap);
        const mxL = allL.reduce((m, l) => Math.max(m, l.lap_number || 0), 0);
        setMaxLaps(mxL);

        // ── Track outline: fetch location data for the first driver that returns ≥ 50 points ──
        // Window: 5 min before to 15 min after session start (covers formation lap + first laps)
        if (drvsArr.length > 0 && !dead) {
          const t0     = new Date(sessionData.date_start);
          const tFrom  = new Date(t0.getTime() - 5 * 60000).toISOString();
          const tTo    = new Date(t0.getTime() + 15 * 60000).toISOString();
          let trackBuilt = false;
          for (let di = 0; di < Math.min(drvsArr.length, 6) && !trackBuilt && !dead; di++) {
            const dNum = drvsArr[di].driver_number;
            try {
              const locR = await fetch(`${OF1}/location?session_key=${sk}&driver_number=${dNum}&date>${tFrom}&date<${tTo}`);
              const locD = await locR.json();
              if (!dead && Array.isArray(locD) && locD.length > 50) {
                // Sample every 3rd point for a denser but manageable path
                const pts = locD.filter((_, i) => i % 3 === 0);
                const xs  = pts.map(p => p.x), ys = pts.map(p => p.y);
                const minX = Math.min(...xs), maxX = Math.max(...xs);
                const minY = Math.min(...ys), maxY = Math.max(...ys);
                const tw = maxX - minX || 1, th = maxY - minY || 1;
                setTrackBounds({ minX, w: tw, minY, h: th });
                setTrackPath(pts.map(p => ({ x: (p.x - minX) / tw, y: (p.y - minY) / th })));
                trackBuilt = true;
              }
            } catch (_) {}
          }
        }

        // ── Driver dot snapshot for completed races (use session date_end) ──
        if (!isLive && !dead && sessionData.date_end) {
          const dateEnd  = new Date(sessionData.date_end);
          const snapFrom = new Date(dateEnd.getTime() - 120000).toISOString();
          const snapTo   = new Date(dateEnd.getTime() + 30000).toISOString();
          try {
            const snapR = await fetch(`${OF1}/location?session_key=${sk}&date>${snapFrom}&date<${snapTo}`);
            const snapD = await snapR.json();
            if (!dead && Array.isArray(snapD) && snapD.length > 0) {
              const latest = {};
              snapD.forEach(loc => {
                const k = String(loc.driver_number);
                if (!latest[k] || loc.date > latest[k].date) latest[k] = loc;
              });
              setDriverDots(latest);
            }
          } catch (_) {}
        }
      } catch (_) {}
      if (!dead) setLoadingData(false);
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.session_key]);

  // ── Effect 4: live polling every 5 s ──────────────────────────────────────
  useEffect(() => {
    if (!sessionData || !isLive) return;
    const sk = sessionData.session_key;
    const poll = async () => {
      const since5s  = new Date(Date.now() - 10000).toISOString();
      const sinceMap = new Date(Date.now() - 5000).toISOString();
      try {
        const [posR, intR, rcR, locR, lapR, stR] = await Promise.all([
          fetch(`${OF1}/position?session_key=${sk}&date>${since5s}`),
          fetch(`${OF1}/intervals?session_key=${sk}&date>${since5s}`),
          fetch(`${OF1}/race_control?session_key=${sk}`),
          fetch(`${OF1}/location?session_key=${sk}&date>${sinceMap}`),
          fetch(`${OF1}/laps?session_key=${sk}`),
          fetch(`${OF1}/stints?session_key=${sk}`),
        ]);
        const [posD, intD, rcD, locD, lapD, stD] = await Promise.all(
          [posR, intR, rcR, locR, lapR, stR].map(r => r.json())
        );
        setLivePositions(prev => {
          const n = { ...prev };
          (Array.isArray(posD) ? posD : []).forEach(p => { const k = String(p.driver_number); if (!n[k] || p.date > n[k].date) n[k] = p; });
          return n;
        });
        setLiveIntervals(prev => {
          const n = { ...prev };
          (Array.isArray(intD) ? intD : []).forEach(i => { const k = String(i.driver_number); if (!n[k] || i.date > n[k].date) n[k] = i; });
          return n;
        });
        setRaceControl([...(Array.isArray(rcD) ? rcD : [])].sort((a,b) => (b.date||"").localeCompare(a.date||"")).slice(0,8));
        const dotLatest = {};
        (Array.isArray(locD) ? locD : []).forEach(loc => {
          const k = String(loc.driver_number);
          if (!dotLatest[k] || loc.date > dotLatest[k].date) dotLatest[k] = loc;
        });
        setDriverDots(dotLatest);
        const lapMap = {};
        (Array.isArray(lapD) ? lapD : []).forEach(l => {
          const k = String(l.driver_number);
          if (l.lap_duration && (!lapMap[k] || l.lap_number > lapMap[k].lap_number)) lapMap[k] = l;
        });
        setLapTimes(lapMap);
        const stMap = {};
        (Array.isArray(stD) ? stD : []).forEach(s => {
          const k = String(s.driver_number);
          if (!stMap[k] || s.stint_number > stMap[k].stint_number) stMap[k] = s;
        });
        setStints(stMap);
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.session_key, isLive]);

  // ── Effect 5: replay auto-advance ─────────────────────────────────────────
  useEffect(() => {
    if (!isReplaying) return;
    const ms = Math.round(2500 / replaySpeed);
    const id = setInterval(() => {
      setReplayLap(prev => {
        if (prev >= maxLaps) { setIsReplaying(false); return prev; }
        return prev + 1;
      });
    }, ms);
    return () => clearInterval(id);
  }, [isReplaying, replaySpeed, maxLaps]);

  // ── Effect 6: fetch location snapshot for current replay lap ──────────────
  useEffect(() => {
    if (!showReplay || !sessionData || !allLapsRaw.length) return;
    if (locSnaps[replayLap] !== undefined) return;

    let dead = false;
    setLoadingSnap(true);

    const sk = sessionData.session_key;
    const lapsAtN = allLapsRaw.filter(l => l.lap_number === replayLap && l.lap_duration != null);
    if (lapsAtN.length === 0) { setLoadingSnap(false); return; }

    // Reference time: earliest lap completion for this lap number (leader's crossing)
    const refMs = lapsAtN.reduce((min, l) => {
      const t = new Date(l.date_start).getTime() + l.lap_duration * 1000;
      return isFinite(t) ? Math.min(min, t) : min;
    }, Infinity);

    if (!isFinite(refMs)) { setLoadingSnap(false); return; }

    // Fetch 25 s before to 10 s after: captures all drivers who finished near the lap
    const from = new Date(refMs - 25000).toISOString();
    const to   = new Date(refMs + 10000).toISOString();

    fetch(`${OF1}/location?session_key=${sk}&date>${from}&date<${to}`)
      .then(r => r.json())
      .then(d => {
        if (dead) return;
        const snap = {};
        if (Array.isArray(d)) {
          d.forEach(loc => {
            const k = String(loc.driver_number);
            if (!snap[k] || loc.date > snap[k].date) snap[k] = loc;
          });
        }
        setLocSnaps(prev => ({ ...prev, [replayLap]: snap }));
      })
      .catch(() => { if (!dead) setLocSnaps(prev => ({ ...prev, [replayLap]: {} })); })
      .finally(() => { if (!dead) setLoadingSnap(false); });

    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayLap, showReplay, sessionData?.session_key]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const COMP_COLOR = { SOFT:"#e10600", MEDIUM:"#f5c518", HARD:"#d8d8d8", INTERMEDIATE:"#00c878", WET:"#4488ff" };
  const SEG_CLR    = { 0:"#1a1a28", 2048:"#f5c518", 2049:"#00e472", 2050:"#b020f5", 2051:"#e10600", 2052:"#e10600" };
  const COUNTRY_FLAGS_LT = { Australia:"🇦🇺", China:"🇨🇳", Japan:"🇯🇵", Bahrain:"🇧🇭", "Saudi Arabia":"🇸🇦",
    "United States":"🇺🇸", Canada:"🇨🇦", Monaco:"🇲🇨", Spain:"🇪🇸", Austria:"🇦🇹",
    "United Kingdom":"🇬🇧", Belgium:"🇧🇪", Hungary:"🇭🇺", Netherlands:"🇳🇱", Italy:"🇮🇹",
    Azerbaijan:"🇦🇿", Singapore:"🇸🇬", Mexico:"🇲🇽", Brazil:"🇧🇷", Qatar:"🇶🇦", "United Arab Emirates":"🇦🇪" };

  const formatLap = s => {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toFixed(3).padStart(6, "0")}`;
  };

  const formatRaceTime = s => {
    if (!s) return "—";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2,"0")}:${sec.toFixed(1).padStart(4,"0")}`
      : `${m}:${sec.toFixed(3).padStart(6,"0")}`;
  };

  const normLoc = raw => {
    if (!trackBounds) return null;
    const { minX, w, minY, h } = trackBounds;
    const x = PAD + (raw.x - minX) / w * (SVG_W - PAD * 2);
    const y = PAD + (1 - (raw.y - minY) / h) * (SVG_H - PAD * 2);
    return isNaN(x) || isNaN(y) ? null : { x, y };
  };

  const codeToNum = {};
  Object.entries(of1Drivers).forEach(([num, d]) => {
    if (d.name_acronym) codeToNum[d.name_acronym.toUpperCase()] = num;
  });

  // ── Normal leaderboard ─────────────────────────────────────────────────────
  const leaderboard = isLive
    ? Object.keys(of1Drivers).map(num => {
        const drv   = of1Drivers[num];
        const pos   = livePositions[num];
        const intv  = liveIntervals[num];
        const lap   = lapTimes[num];
        const stint = stints[num];
        const lapN  = lap?.lap_number || 0;
        return {
          num, position: pos?.position || 99,
          code: drv.name_acronym || `#${num}`,
          fullName: drv.full_name || "",
          teamColor: drv.team_colour ? `#${drv.team_colour}` : "#888",
          gap: intv?.gap_to_leader ?? null,
          lastLap: lap?.lap_duration,
          segments: [...(lap?.segments_sector_1||[]),...(lap?.segments_sector_2||[]),...(lap?.segments_sector_3||[])],
          compound: stint?.compound || "",
          tyreAge: lapN > 0 && stint?.lap_start ? lapN - stint.lap_start + 1 : 0,
        };
      }).sort((a,b) => a.position - b.position)
    : ergastResults.map((r, i) => {
        const code  = r.Driver.code.toUpperCase();
        const num   = codeToNum[code];
        const drv   = num ? of1Drivers[num] : null;
        const stint = num ? stints[num] : null;
        const lap   = num ? lapTimes[num] : null;
        const lapN  = lap?.lap_number || 0;
        const gap   = i === 0
          ? (r.Time?.time || "Winner")
          : (r.Time?.time ? `+${r.Time.time}` : r.status || "—");
        return {
          num, position: parseInt(r.position),
          code: r.Driver.code,
          fullName: `${r.Driver.givenName} ${r.Driver.familyName}`,
          teamColor: drv?.team_colour ? `#${drv.team_colour}` : "#888",
          team: r.Constructor.name,
          gap,
          lastLap: lap?.lap_duration,
          segments: [...(lap?.segments_sector_1||[]),...(lap?.segments_sector_2||[]),...(lap?.segments_sector_3||[])],
          compound: stint?.compound || "",
          tyreAge: lapN > 0 && stint?.lap_start ? lapN - stint.lap_start + 1 : 0,
        };
      });

  // ── Replay leaderboard (computed from allLapsRaw at replayLap) ─────────────
  const replayLeaderboard = (() => {
    if (!showReplay || !allLapsRaw.length) return [];
    const byDriver = {};
    allLapsRaw.forEach(l => {
      const k = String(l.driver_number);
      if (!byDriver[k]) byDriver[k] = [];
      byDriver[k].push(l);
    });
    const entries = Object.entries(byDriver).map(([num, laps]) => {
      const done = laps.filter(l => l.lap_number <= replayLap && l.lap_duration != null);
      const lapsCompleted = done.reduce((m, l) => Math.max(m, l.lap_number || 0), 0);
      const cumTime = done.reduce((s, l) => s + (l.lap_duration || 0), 0);
      const lastLapObj = done.find(l => l.lap_number === lapsCompleted);
      const drv   = of1Drivers[num] || {};
      const stint = stints[num] || null;
      return {
        num,
        code: drv.name_acronym || `#${num}`,
        fullName: drv.full_name || "",
        teamColor: drv.team_colour ? `#${drv.team_colour}` : "#888",
        lapsCompleted,
        cumTime,
        lastLap: lastLapObj?.lap_duration,
        compound: stint?.compound || "",
        segments: [...(lastLapObj?.segments_sector_1||[]),(lastLapObj?.segments_sector_2||[]),(lastLapObj?.segments_sector_3||[])].flat(),
      };
    }).filter(d => d.lapsCompleted > 0)
      .sort((a,b) => b.lapsCompleted - a.lapsCompleted || a.cumTime - b.cumTime);

    const leaderCum  = entries[0]?.cumTime || 0;
    const leaderLaps = entries[0]?.lapsCompleted || 0;
    return entries.map((d, i) => ({
      ...d,
      position: i + 1,
      gap: i === 0
        ? formatRaceTime(d.cumTime)
        : d.lapsCompleted < leaderLaps
          ? `+${leaderLaps - d.lapsCompleted}L`
          : `+${(d.cumTime - leaderCum).toFixed(3)}s`,
    }));
  })();

  const flagStatus = (() => {
    for (const msg of raceControl) {
      const f = (msg.flag || "").toUpperCase(), c = (msg.category || "").toUpperCase();
      if (f === "RED"           || c.includes("RED FLAG"))   return { label: "RED FLAG",           color: "#e10600" };
      if (f.includes("SAFETY") || c.includes("SAFETY CAR")) return { label: "SAFETY CAR",         color: "#ff8c00" };
      if (f.includes("VIRTUAL")|| c.includes("VIRTUAL"))    return { label: "VIRTUAL SAFETY CAR", color: "#f5c518" };
    }
    return null;
  })();

  const trackSVGPath = trackPath.length
    ? trackPath.map((p, i) => {
        const x = (PAD + p.x * (SVG_W - PAD*2)).toFixed(1);
        const y = (PAD + (1-p.y) * (SVG_H - PAD*2)).toFixed(1);
        return `${i===0?"M":"L"}${x},${y}`;
      }).join(" ") + " Z"
    : "";

  // Active data: swap to replay sources when replay mode is on
  const activeLeaderboard = showReplay ? replayLeaderboard : leaderboard;
  const activeDots        = showReplay ? (locSnaps[replayLap] || {}) : driverDots;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadingInit) return (
    <div style={{ textAlign:"center", padding:"5rem 1rem", color:"#555", fontSize:"0.85rem" }}>
      Loading schedule...
    </div>
  );
  if (allRaces.length === 0) return (
    <div style={{ textAlign:"center", padding:"5rem 1rem", color:"#555", fontSize:"0.85rem" }}>
      No completed 2026 races yet.
    </div>
  );

  return (
    <div>
      {/* ── Race selector ── */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize:"0.6rem", letterSpacing:"0.2em", color:"#e10600", fontFamily:"monospace",
          textTransform:"uppercase", marginBottom:"0.6rem" }}>Select Race</div>
        <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
          {allRaces.map(race => {
            const active = selectedRace?.round === race.round;
            const flag = COUNTRY_FLAGS_LT[race.Circuit.Location.country] || "🏁";
            return (
              <button key={race.round} onClick={() => setSelectedRace(race)} style={{
                background: active ? "#1e1e2e" : "transparent",
                border: `1px solid ${active ? "#e10600" : "#1f1f2e"}`,
                color: active ? "#fff" : "#555",
                padding: "0.35rem 0.65rem", borderRadius: 6, cursor:"pointer",
                fontSize:"0.72rem", transition:"all 0.15s", whiteSpace:"nowrap",
              }}>
                {flag} {race.raceName.replace(" Grand Prix","")}
                {isLive && sessionData && allRaces.indexOf(race) === allRaces.findIndex(r => r.round === selectedRace?.round) && (
                  <span style={{ marginLeft:"0.4rem", color:"#00ff88", fontSize:"0.6rem" }}>● LIVE</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!sessionData && !loadingData && (
        <div style={{ color:"#555", textAlign:"center", padding:"2rem", fontSize:"0.82rem" }}>
          Select a race above to load timing data.
        </div>
      )}

      {loadingData && (
        <div style={{ color:"#555", textAlign:"center", padding:"3rem", fontSize:"0.82rem" }}>
          Loading race data from OpenF1...
        </div>
      )}

      {sessionData && !loadingData && (
        <>
          {/* ── Flag banner ── */}
          {flagStatus && (
            <div style={{ background:`${flagStatus.color}18`, border:`1px solid ${flagStatus.color}77`,
              borderRadius:8, padding:"0.6rem 1rem", marginBottom:"1rem",
              display:"flex", alignItems:"center", gap:"0.75rem" }}>
              <div style={{ width:10, height:10, background:flagStatus.color, borderRadius:2,
                boxShadow:`0 0 8px ${flagStatus.color}`, flexShrink:0 }} />
              <span style={{ fontWeight:700, color:flagStatus.color, fontSize:"0.88rem",
                letterSpacing:"0.12em", fontFamily:"monospace" }}>{flagStatus.label}</span>
            </div>
          )}

          {/* ── Session header ── */}
          <div style={{ display:"flex", alignItems:"center", gap:"0.75rem",
            marginBottom:"1rem", flexWrap:"wrap" }}>
            {isLive
              ? <div style={{ width:8, height:8, borderRadius:"50%", background:"#00ff88",
                  boxShadow:"0 0 8px #00ff88" }} />
              : <div style={{ width:8, height:8, borderRadius:"50%", background:"#333" }} />}
            <span style={{ fontWeight:700, fontSize:"0.8rem", letterSpacing:"0.1em",
              fontFamily:"monospace", color: isLive ? "#00ff88" : "#666" }}>
              {isLive ? "LIVE" : showReplay ? `REPLAY — LAP ${replayLap}/${maxLaps}` : "RESULT"}
            </span>
            <span style={{ color:"#888", fontSize:"0.82rem" }}>
              {selectedRace?.raceName} — {sessionData.circuit_short_name}
            </span>
            {raceControl[0]?.message && !showReplay && (
              <span style={{ fontSize:"0.68rem", color:"#555", fontStyle:"italic", marginLeft:"auto",
                maxWidth:260, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {raceControl[0].message}
              </span>
            )}
          </div>

          {/* ── Main grid ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 345px", gap:"1.25rem", alignItems:"start" }}>

            {/* Leaderboard */}
            <div>
              <SectionTitle>
                {isLive ? "Live Leaderboard" : showReplay ? `Replay — Lap ${replayLap}` : "Race Result"}
              </SectionTitle>
              <div style={{ display:"flex", gap:"0.5rem", padding:"0 0.7rem 0.35rem",
                fontSize:"0.58rem", color:"#3a3a4a", letterSpacing:"0.12em",
                textTransform:"uppercase", fontFamily:"monospace" }}>
                <span style={{ width:22 }}>P</span>
                <span style={{ flex:1 }}>Driver</span>
                <span style={{ width:90, textAlign:"right" }}>Gap / Time</span>
                <span style={{ width:76, textAlign:"right" }}>Last Lap</span>
                <span style={{ width:46, textAlign:"center" }}>Tyre</span>
              </div>

              {activeLeaderboard.length === 0 && (
                <div style={{ color:"#444", textAlign:"center", padding:"2rem", fontSize:"0.82rem" }}>
                  {showReplay ? "No lap data for this race." : "No data yet..."}
                </div>
              )}

              {activeLeaderboard.map((d, i) => {
                const cColor   = COMP_COLOR[d.compound] || "#555";
                const posColor = i === 0 ? "#e10600" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#555";
                return (
                  <div key={d.num || i} style={{
                    display:"flex", alignItems:"center", gap:"0.5rem",
                    padding:"0.5rem 0.7rem",
                    background: i % 2 === 0 ? "#12121a" : "#0e0e17",
                    borderLeft:`3px solid ${d.teamColor}`,
                    marginBottom:2, borderRadius:4,
                    transition: showReplay ? "all 0.4s ease" : undefined,
                  }}>
                    <span style={{ fontFamily:"monospace", fontSize:"0.82rem", width:22,
                      flexShrink:0, color:posColor, fontWeight:700 }}>
                      {d.position}
                    </span>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                        <span style={{ fontWeight:700, fontSize:"0.83rem", color:d.teamColor,
                          letterSpacing:"0.03em" }}>{d.code}</span>
                        <span style={{ fontSize:"0.67rem", color:"#666", overflow:"hidden",
                          textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:120 }}>
                          {d.fullName}
                        </span>
                        {showReplay && d.lapsCompleted != null && (
                          <span style={{ fontSize:"0.6rem", color:"#444", fontFamily:"monospace", marginLeft:"auto" }}>
                            L{d.lapsCompleted}
                          </span>
                        )}
                      </div>
                      {(d.segments || []).length > 0 && (
                        <div style={{ display:"flex", gap:1.5, marginTop:3 }}>
                          {d.segments.slice(0,18).map((seg,si) => (
                            <div key={si} style={{ width:5, height:3, borderRadius:1, flexShrink:0,
                              background: SEG_CLR[seg] ?? SEG_CLR[0] }} />
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ width:90, textAlign:"right", flexShrink:0 }}>
                      <span style={{ fontSize:"0.73rem", fontFamily:"monospace",
                        color: i === 0 ? "#00e472" : "#aaa" }}>
                        {d.gap ?? "—"}
                      </span>
                    </div>

                    <div style={{ width:76, textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:"0.71rem", fontFamily:"monospace", color:"#bbb" }}>
                        {formatLap(d.lastLap)}
                      </div>
                    </div>

                    <div style={{ width:46, textAlign:"center", flexShrink:0 }}>
                      {d.compound ? (
                        <>
                          <div style={{ fontSize:"0.62rem", fontWeight:700, color:cColor,
                            background:`${cColor}18`, border:`1px solid ${cColor}50`,
                            borderRadius:4, padding:"0.1rem 0.25rem", display:"inline-block" }}>
                            {d.compound[0]}
                          </div>
                          {d.tyreAge > 0 && (
                            <div style={{ fontSize:"0.57rem", color:"#555", marginTop:1 }}>
                              {d.tyreAge}L
                            </div>
                          )}
                        </>
                      ) : <span style={{ color:"#333", fontSize:"0.7rem" }}>—</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right column: replay controls + map + sector key */}
            <div>

              {/* ── Replay controls (completed races only) ── */}
              {!isLive && maxLaps > 0 && (
                <div style={{ marginBottom:"0.85rem" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.5rem" }}>
                    <button onClick={() => {
                      setShowReplay(v => !v);
                      setIsReplaying(false);
                      setReplayLap(1);
                    }} style={{
                      background: showReplay ? "#e10600" : "transparent",
                      border: `1px solid ${showReplay ? "#e10600" : "#2a2a3a"}`,
                      color: showReplay ? "#fff" : "#666",
                      padding:"0.3rem 0.8rem", borderRadius:5, cursor:"pointer",
                      fontSize:"0.68rem", fontFamily:"monospace", letterSpacing:"0.1em",
                    }}>
                      {showReplay ? "◀ EXIT REPLAY" : "▶ REPLAY MODE"}
                    </button>
                    {showReplay && (
                      <span style={{ fontSize:"0.63rem", color:"#555", fontFamily:"monospace" }}>
                        {maxLaps} laps total
                      </span>
                    )}
                  </div>

                  {showReplay && (
                    <div style={{ background:"#0e0e17", border:"1px solid #1f1f2e",
                      borderRadius:8, padding:"0.7rem 0.85rem" }}>

                      {/* Play/pause + reset + speed */}
                      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.6rem" }}>
                        <button onClick={() => setIsReplaying(v => !v)} style={{
                          background: isReplaying ? "#f5c518" : "#00c878",
                          border:"none", color:"#000", fontWeight:700,
                          width:30, height:30, borderRadius:"50%", cursor:"pointer",
                          fontSize:"0.9rem", lineHeight:1, flexShrink:0,
                        }}>
                          {isReplaying ? "⏸" : "▶"}
                        </button>

                        <button onClick={() => { setIsReplaying(false); setReplayLap(1); }} style={{
                          background:"transparent", border:"1px solid #1f1f2e",
                          color:"#555", width:26, height:26, borderRadius:"50%",
                          cursor:"pointer", fontSize:"0.75rem", lineHeight:1, flexShrink:0,
                        }} title="Reset">↺</button>

                        <div style={{ display:"flex", gap:3, marginLeft:"auto", alignItems:"center" }}>
                          {loadingSnap && (
                            <span style={{ fontSize:"0.58rem", color:"#555", fontFamily:"monospace" }}>
                              loading...
                            </span>
                          )}
                          {[1, 2, 4].map(s => (
                            <button key={s} onClick={() => setReplaySpeed(s)} style={{
                              background: replaySpeed === s ? "#1e1e2e" : "transparent",
                              border: `1px solid ${replaySpeed === s ? "#e10600" : "#1f1f2e"}`,
                              color: replaySpeed === s ? "#e10600" : "#555",
                              padding:"0.2rem 0.4rem", borderRadius:4, cursor:"pointer",
                              fontSize:"0.62rem", fontFamily:"monospace",
                            }}>{s}×</button>
                          ))}
                        </div>
                      </div>

                      {/* Lap slider */}
                      <input
                        type="range" min={1} max={maxLaps} value={replayLap}
                        onChange={e => { setIsReplaying(false); setReplayLap(Number(e.target.value)); }}
                        style={{ width:"100%", accentColor:"#e10600", cursor:"pointer" }}
                      />
                      <div style={{ display:"flex", justifyContent:"space-between",
                        fontSize:"0.57rem", color:"#3a3a4a", fontFamily:"monospace", marginTop:2 }}>
                        <span>LAP 1</span>
                        <span style={{ color:"#e10600" }}>LAP {replayLap}</span>
                        <span>LAP {maxLaps}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <SectionTitle>Circuit Map</SectionTitle>
              <div style={{ background:"#12121a", border:"1px solid #1f1f2e", borderRadius:10,
                padding:"0.75rem", marginBottom:"0.85rem" }}>
                <svg width={SVG_W} height={SVG_H} style={{ display:"block" }}>
                  {/* Track outline */}
                  {trackSVGPath && <>
                    <path d={trackSVGPath} fill="none" stroke="#1e1e30" strokeWidth={10}
                      strokeLinejoin="round" strokeLinecap="round" />
                    <path d={trackSVGPath} fill="none" stroke="#3c3c58" strokeWidth={2.5}
                      strokeLinejoin="round" strokeLinecap="round" />
                  </>}
                  {!trackSVGPath && (
                    <text x={SVG_W/2} y={SVG_H/2} textAnchor="middle" fill="#333"
                      fontSize={10} fontFamily="monospace">Loading track...</text>
                  )}

                  {/* Driver dots */}
                  {trackBounds && Object.entries(activeDots).map(([num, raw]) => {
                    const pt  = normLoc(raw);
                    if (!pt) return null;
                    const drv = of1Drivers[num] || {};
                    const col = drv.team_colour ? `#${drv.team_colour}` : "#888";
                    return (
                      <g key={num} style={{ transition: showReplay ? "all 0.4s ease" : undefined }}>
                        <circle cx={pt.x} cy={pt.y} r={5} fill={col} stroke="#000" strokeWidth={1.5} />
                        <text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize={6.5}
                          fill={col} fontFamily="monospace" fontWeight="bold">
                          {drv.name_acronym || num}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div style={{ fontSize:"0.6rem", color:"#444", marginTop:4,
                  textAlign:"center", fontFamily:"monospace" }}>
                  {Object.keys(activeDots).length > 0
                    ? showReplay
                      ? `Lap ${replayLap} — ${Object.keys(activeDots).length} drivers`
                      : `${isLive ? "Live" : "Final lap"} — ${Object.keys(activeDots).length} drivers`
                    : trackSVGPath
                      ? showReplay ? "Scrub slider or press play" : "Fetching driver positions..."
                      : ""}
                </div>
              </div>

              <SectionTitle>Sector Key</SectionTitle>
              <div style={{ background:"#12121a", border:"1px solid #1f1f2e", borderRadius:10,
                padding:"0.6rem 0.85rem", marginBottom:"0.85rem" }}>
                {[["#b020f5","Fastest overall"],["#00e472","Personal best"],["#f5c518","No improvement"]].map(([col,lbl]) => (
                  <div key={lbl} style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.35rem" }}>
                    <div style={{ width:16, height:6, borderRadius:2, background:col, flexShrink:0 }} />
                    <span style={{ fontSize:"0.7rem", color:"#777" }}>{lbl}</span>
                  </div>
                ))}
              </div>

              {raceControl.length > 0 && !showReplay && (
                <>
                  <SectionTitle>Race Control</SectionTitle>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {raceControl.slice(0,5).map((msg,i) => (
                      <div key={i} style={{ background:"#12121a", border:"1px solid #1f1f2e",
                        borderLeft: i===0 ? "2px solid #e1060055" : "2px solid #1f1f2e",
                        borderRadius:6, padding:"0.4rem 0.65rem",
                        fontSize:"0.68rem", color: i===0 ? "#aaa" : "#444" }}>
                        {msg.message || "—"}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function F1Tracker() {
  const [tab, setTab] = useState("standings");
  const [drivers, setDrivers] = useState(initialDrivers);
  const [constructors, setConstructors] = useState(initialConstructors);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedRace, setSelectedRace] = useState(0);
  const [mlPredictions, setMlPredictions] = useState([]);
  const [raceMlPredictions, setRaceMlPredictions] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loadingRace, setLoadingRace] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [liveRound, setLiveRound] = useState(1);
  const [liveLoading, setLiveLoading] = useState(false);

  useEffect(() => {
    fetch("https://api.jolpi.ca/ergast/f1/2026/driverStandings.json")
      .then(r => r.json())
      .then(data => {
        const standingsData = data.MRData.StandingsTable.StandingsLists[0].DriverStandings;
        const liveDrivers = standingsData.map(entry => ({
          id: entry.Driver.code,
          name: `${entry.Driver.givenName} ${entry.Driver.familyName}`,
          team: entry.Constructors[0].name,
          pts: parseInt(entry.points),
          color: initialDrivers.find(d => d.id === entry.Driver.code)?.color ?? "#888888",
          nationality: initialDrivers.find(d => d.id === entry.Driver.code)?.nationality ?? "🏁",
          ratings: initialDrivers.find(d => d.id === entry.Driver.code)?.ratings ?? { pace: 80, consistency: 80, racecraft: 80, qualifying: 80, wet: 80 },
          raceHistory: [parseInt(entry.points)],
        }));
        setDrivers(liveDrivers);
      }).catch(() => {});

    fetch("https://api.jolpi.ca/ergast/f1/2026/constructorStandings.json")
      .then(r => r.json())
      .then(data => {
        const cData = data.MRData.StandingsTable.StandingsLists[0].ConstructorStandings;
        setConstructors(cData.map(entry => ({
          id: entry.Constructor.constructorId,
          name: entry.Constructor.name,
          pts: parseInt(entry.points),
          color: initialConstructors.find(c => c.name === entry.Constructor.name)?.color ?? "#888888",
          drivers: [],
        })));
      }).catch(() => {});

    fetch(`${API_URL}/api/championship`)
      .then(r => r.json())
      .then(data => setMlPredictions(data.predictions || []))
      .catch(() => {});

    fetch(`${API_URL}/api/schedule`)
      .then(r => r.json())
      .then(data => setSchedule((data.races || []).filter(r => r.round > COMPLETED_ROUNDS)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (schedule.length === 0) return;
    const race = schedule[selectedRace];
    if (!race) return;
    setLoadingRace(true);
    setRaceMlPredictions([]);
    fetch(`${API_URL}/api/race/${race.round}`)
      .then(r => r.json())
      .then(data => { setRaceMlPredictions(data.predictions || []); setLoadingRace(false); })
      .catch(() => setLoadingRace(false));
  }, [selectedRace, schedule]);

  useEffect(() => {
    if (tab !== "live") return;
    setLiveLoading(true);
    const fetchLive = () => {
      fetch(`${API_URL}/api/race/live/${liveRound}`)
        .then(r => r.json())
        .then(data => { setLiveData(data); setLiveLoading(false); })
        .catch(() => setLiveLoading(false));
    };
    fetchLive();
    const interval = setInterval(fetchLive, 15000);
    return () => clearInterval(interval);
  }, [tab, liveRound]);

  const predicted = predictChampionship(drivers);
  const racePredictions = predictRaceWinner(schedule[selectedRace] || {}, drivers);
  const getDriverInfo = (code) => initialDrivers.find(d => d.id === code) ?? {};
  const currentRace = schedule[selectedRace];

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: bg, minHeight: "100vh", color: text, padding: "1.5rem 1rem" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <span style={{ color: accent, fontSize: "1.4rem" }}>⬡</span>
            <span style={{ fontSize: "0.65rem", letterSpacing: "0.25em", color: muted, textTransform: "uppercase", fontFamily: "monospace" }}>
              F1 STAT TRACKER · 2026 SEASON
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(1.4rem, 4vw, 2.2rem)", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Championship<span style={{ color: accent }}> Intelligence</span>
          </h1>
          <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem", color: muted }}>Round <span style={{ color: "#fff" }}>{COMPLETED_ROUNDS}</span> / {TOTAL_ROUNDS} complete</span>
            {drivers[0] && (
              <span style={{ fontSize: "0.78rem", color: muted }}>Leader: <span style={{ color: drivers[0].color || "#00D2BE" }}>{drivers[0].name.split(" ").map((n,i) => i===0 ? n[0]+"." : n).join(" ")}</span> — {drivers[0].pts} pts</span>
            )}
            <span style={{ fontSize: "0.78rem", color: muted }}>Last: <span style={{ color: accent }}>🇦🇺 Australian GP</span></span>
          </div>
          <div style={{ marginTop: "0.75rem", height: 3, background: "#1a1a24", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(COMPLETED_ROUNDS / TOTAL_ROUNDS) * 100}%`, background: accent, borderRadius: 99, transition: "width 1s ease" }} />
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {[["standings","Standings"],["constructors","Constructors"],["predict","Championship Prediction"],["race","Race Predictor"],["live","🔴 Live Race"],["timing","⏱ Live Timing"]].map(([id,label]) => (
            <Tab key={id} label={label} active={tab===id} onClick={() => setTab(id)} />
          ))}
        </div>

        {/* ── STANDINGS TAB ── */}
        {tab === "standings" && (
          <div>
            <SectionTitle>Drivers' Championship — After Round 1</SectionTitle>
            {drivers.map((d, i) => (
              <div key={d.id} onClick={() => setSelectedDriver(selectedDriver?.id === d.id ? null : d)}
                style={{
                  background: selectedDriver?.id === d.id ? `${d.color}15` : card,
                  border: `1px solid ${selectedDriver?.id === d.id ? d.color+"44" : border}`,
                  borderRadius: 8, padding: "0.85rem 1rem", marginBottom: "0.5rem",
                  cursor: "pointer", transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: "1rem",
                }}>
                <span style={{ color: i < 3 ? [accent,"#C0C0C0","#CD7F32"][i] : muted, fontFamily: "monospace", fontSize: "0.85rem", width: 22, flexShrink: 0 }}>
                  P{i+1}
                </span>
                <DriverAvatar driverId={d.id} name={d.name} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{d.nationality} {d.name}</div>
                  <div style={{ fontSize: "0.75rem", color: muted }}>{d.team}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: d.color, fontSize: "1.1rem" }}>{d.pts}</div>
                  <div style={{ fontSize: "0.65rem", color: muted }}>PTS</div>
                </div>
                <div style={{ width: 80 }}>
                  <div style={{ height: 4, background: "#1a1a24", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(d.pts/25)*100}%`, background: d.color, borderRadius: 99 }} />
                  </div>
                </div>
              </div>
            ))}
            {selectedDriver && (
              <Card style={{ marginTop: "1rem", borderColor: selectedDriver.color+"44" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                  <DriverAvatar driverId={selectedDriver.id} name={selectedDriver.name} size={56} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{selectedDriver.name}</div>
                    <div style={{ fontSize: "0.78rem", color: muted }}>{selectedDriver.team}</div>
                  </div>
                </div>
                <SectionTitle>Driver Ratings</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                  <div>
                    {Object.entries(selectedDriver.ratings).map(([k, v]) => (
                      <div key={k} style={{ marginBottom: "0.6rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.25rem" }}>
                          <span style={{ color: muted, textTransform: "capitalize" }}>{k}</span>
                          <span style={{ color: selectedDriver.color }}>{v}</span>
                        </div>
                        <div style={{ height: 5, background: "#1a1a24", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${v}%`, background: selectedDriver.color, borderRadius: 99 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                      ["Current Pts", selectedDriver.pts],
                      ["Season Avg", (selectedDriver.pts / COMPLETED_ROUNDS).toFixed(1) + " / race"],
                      ["Overall Rating", (Object.values(selectedDriver.ratings).reduce((a,b)=>a+b,0)/5).toFixed(0)],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: "#0f0f18", borderRadius: 8, padding: "0.75rem" }}>
                        <div style={{ fontSize: "0.65rem", color: muted, marginBottom: "0.25rem" }}>{label}</div>
                        <div style={{ fontSize: "1.2rem", fontWeight: 700, color: selectedDriver.color }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── CONSTRUCTORS TAB ── */}
        {tab === "constructors" && (
          <div>
            <SectionTitle>Constructors' Championship — After Round 1</SectionTitle>
            {constructors.map((c, i) => (
              <Card key={c.id} style={{ marginBottom: "0.6rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span style={{ color: i < 3 ? [accent,"#C0C0C0","#CD7F32"][i] : muted, fontFamily: "monospace", fontSize: "0.85rem", width: 22 }}>P{i+1}</span>
                  <div style={{ width: 3, height: 36, background: c.color, borderRadius: 99, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div style={{ height: 5, background: "#1a1a24", borderRadius: 99, overflow: "hidden", marginTop: "0.4rem" }}>
                      <div style={{ height: "100%", width: `${(c.pts/43)*100}%`, background: c.color, borderRadius: 99 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "1.2rem", fontWeight: 700, color: c.color }}>{c.pts}</span>
                    <span style={{ fontSize: "0.7rem", color: muted }}> pts</span>
                  </div>
                </div>
              </Card>
            ))}
            <Card style={{ marginTop: "1rem" }}>
              <SectionTitle>Points Comparison</SectionTitle>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={constructors.slice(0,6)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fill: muted, fontSize: 10 }} />
                  <YAxis tick={{ fill: muted, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: card, border: `1px solid ${border}`, fontSize: "0.8rem" }} />
                  <Bar dataKey="pts" radius={[4,4,0,0]}>
                    {constructors.slice(0,6).map(c => <Cell key={c.id} fill={c.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ── CHAMPIONSHIP PREDICTION TAB ── */}
        {tab === "predict" && (
          <div>
            <Card style={{ marginBottom: "1rem", borderColor: accent+"33", background: "#130a0a" }}>
              <div style={{ fontSize: "0.78rem", color: "#f0a0a0", lineHeight: 1.6 }}>
                ⚠️ <strong style={{ color: "#fff" }}>Early Season Caution:</strong> Only 1 of 24 races complete. Predictions carry high uncertainty.
              </div>
            </Card>
            {mlPredictions.length > 0 && (
              <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "#0a1628", border: "1px solid #1E41FF44", borderRadius: 8 }}>
                <div style={{ fontSize: "0.65rem", color: "#1E41FF", letterSpacing: "0.15em", fontFamily: "monospace", marginBottom: "0.25rem" }}>ML MODEL ACTIVE</div>
                <div style={{ fontSize: "0.78rem", color: "#aaa" }}>Predictions powered by Random Forest trained on 2010–2025 data + FastF1 pace ratings</div>
              </div>
            )}
            <SectionTitle>Projected Final Championship Standings</SectionTitle>
            {(mlPredictions.length > 0 ? mlPredictions : predicted).slice(0,8).map((d, i) => {
              const info = getDriverInfo(d.driver || d.id);
              const driverName = d.name || info.name || d.driver || "Unknown";
              const driverColor = d.color || info.color || "#e10600";
              return (
                <Card key={i} style={{ marginBottom: "0.6rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ color: i < 3 ? [accent,"#C0C0C0","#CD7F32"][i] : muted, fontFamily: "monospace", fontSize: "0.85rem", width: 22 }}>P{i+1}</span>
                    <DriverAvatar driverId={d.driver || d.id} name={driverName} size={36} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 600 }}>{driverName}</span>
                        <span style={{ fontSize: "0.72rem", color: muted }}>({d.team})</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.3rem" }}>
                        <span style={{ fontSize: "0.7rem", color: muted }}>Now: <span style={{ color: "#fff" }}>{d.pts || d.current_points}pts</span></span>
                        <span style={{ fontSize: "0.7rem", color: muted }}>→</span>
                        <span style={{ fontSize: "0.7rem", color: driverColor }}>Projected: <strong>{d.projectedPts || d.predicted_points}pts</strong></span>
                      </div>
                      <div style={{ height: 4, background: "#1a1a24", borderRadius: 99, overflow: "hidden", marginTop: "0.4rem" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, ((d.projectedPts || d.predicted_points) / ((mlPredictions[0] || predicted[0])?.predicted_points || (mlPredictions[0] || predicted[0])?.projectedPts || 1)) * 100)}%`, background: driverColor, borderRadius: 99 }} />
                      </div>
                    </div>
                    <div style={{ background: `${driverColor}22`, border: `1px solid ${driverColor}44`, borderRadius: 8, padding: "0.35rem 0.65rem", textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: driverColor }}>{d.confidence || d.win_probability}%</div>
                      <div style={{ fontSize: "0.6rem", color: muted }}>title odds</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── RACE PREDICTOR TAB ── */}
        {tab === "race" && (
          <div>
            <SectionTitle>Select Race</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.5rem", marginBottom: "1.5rem" }}>
              {schedule.map((r, i) => (
                <button key={i} onClick={() => setSelectedRace(i)} style={{
                  background: selectedRace === i ? "#1e1e2e" : "transparent",
                  border: `1px solid ${selectedRace === i ? accent : border}`,
                  color: selectedRace === i ? "#fff" : muted,
                  padding: "0.6rem 0.75rem", borderRadius: 8, cursor: "pointer",
                  fontSize: "0.78rem", textAlign: "left", transition: "all 0.2s",
                }}>
                  <div style={{ fontSize: "1rem", marginBottom: "0.15rem" }}>{COUNTRY_FLAGS[r.country] || "🏁"}</div>
                  <div style={{ fontWeight: selectedRace === i ? 600 : 400 }}>{r.name.replace(" Grand Prix", "")}</div>
                  <div style={{ fontSize: "0.68rem", color: selectedRace === i ? muted : "#444" }}>R{r.round}</div>
                </button>
              ))}
            </div>

            {currentRace && (
              <Card style={{ marginBottom: "1rem", borderColor: accent + "33", background: "#0f0a0a" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span style={{ fontSize: "2rem" }}>{COUNTRY_FLAGS[currentRace.country] || "🏁"}</span>
                  <div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{currentRace.name}</div>
                    <div style={{ fontSize: "0.78rem", color: muted }}>Round {currentRace.round} · {currentRace.circuit}</div>
                  </div>
                </div>
              </Card>
            )}

            <SectionTitle>Race Win Probability</SectionTitle>

            {loadingRace && (
              <div style={{ textAlign: "center", padding: "2rem", color: muted, fontSize: "0.85rem" }}>
                ⏳ Loading predictions...
              </div>
            )}

            {!loadingRace && (raceMlPredictions.length > 0 ? raceMlPredictions : racePredictions).slice(0, 8).map((d, i) => {
              const info = getDriverInfo(d.driver || d.id);
              const driverName = d.name || info.name || d.driver || "Unknown";
              const driverNationality = d.nationality || info.nationality || "🏁";
              const driverColor = d.color || info.color || "#e10600";
              const winProb = d.winPct || d.win_probability || 0;
              return (
                <Card key={i} style={{ marginBottom: "0.6rem", borderColor: i === 0 ? accent + "44" : border }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                    <span style={{ color: i < 3 ? [accent, "#C0C0C0", "#CD7F32"][i] : muted, fontFamily: "monospace", fontSize: "0.8rem", width: 22, flexShrink: 0 }}>P{i+1}</span>
                    <DriverAvatar driverId={d.driver || d.id} name={driverName} size={44} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span style={{ fontSize: "0.85rem" }}>{driverNationality}</span>
                        <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{driverName}</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: muted, marginBottom: "0.3rem" }}>{d.team}</div>
                      {d.circuit_avg_finish && (
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                          <span style={{ fontSize: "0.68rem", background: "#1a1a2e", borderRadius: 4, padding: "0.15rem 0.4rem", color: "#aaa" }}>P{d.qualifying_position} quali</span>
                          <span style={{ fontSize: "0.68rem", background: "#1a1a2e", borderRadius: 4, padding: "0.15rem 0.4rem", color: "#aaa" }}>avg P{d.circuit_avg_finish} here</span>
                          <span style={{ fontSize: "0.68rem", background: "#1a1a2e", borderRadius: 4, padding: "0.15rem 0.4rem", color: "#aaa" }}>{d.circuit_podium_rate}% podium rate</span>
                        </div>
                      )}
                      <div style={{ height: 4, background: "#1a1a24", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, winProb * 2.5)}%`, background: driverColor, borderRadius: 99, transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                    <div style={{ background: `${driverColor}22`, border: `1px solid ${driverColor}44`, borderRadius: 8, padding: "0.4rem 0.7rem", textAlign: "center", flexShrink: 0, minWidth: 52 }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: driverColor }}>{winProb}%</div>
                      <div style={{ fontSize: "0.6rem", color: muted }}>win</div>
                    </div>
                  </div>
                </Card>
              );
            })}
            <div style={{ fontSize: "0.72rem", color: muted, marginTop: "0.75rem" }}>
              * Probabilities based on ML model, estimated qualifying, circuit history and car pace.
            </div>
          </div>
        )}

        {/* ── LIVE RACE TAB ── */}
        {tab === "live" && (
          <div>
            <SectionTitle>Live Race Prediction</SectionTitle>

            {/* Round selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.78rem", color: muted }}>Race:</span>
              {Array.from({length: COMPLETED_ROUNDS + 2}, (_, i) => i + 1).map(r => (
                <button key={r} onClick={() => setLiveRound(r)} style={{
                  background: liveRound === r ? accent : "transparent",
                  border: `1px solid ${liveRound === r ? accent : border}`,
                  color: liveRound === r ? "#fff" : muted,
                  padding: "0.3rem 0.75rem", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem",
                }}>R{r}</button>
              ))}
            </div>

            {liveLoading && !liveData && (
              <div style={{ textAlign: "center", padding: "3rem", color: muted }}>Loading...</div>
            )}

            {liveData && (
              <>
                {/* Status bar */}
                <Card style={{ marginBottom: "1rem", borderColor: liveData.state === "live" ? "#00ff8844" : liveData.state === "finished" ? "#C0C0C044" : border }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {liveData.state === "live" && (
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 8px #00ff88", animation: "pulse 1.5s infinite" }} />
                      )}
                      <span style={{ fontWeight: 700, fontSize: "0.95rem", color: liveData.state === "live" ? "#00ff88" : liveData.state === "finished" ? "#C0C0C0" : text }}>
                        {liveData.state === "live" ? "LIVE" : liveData.state === "finished" ? "FINISHED" : "PRE-RACE"}
                      </span>
                      {liveData.race_control && liveData.race_control !== "NONE" && (
                        <span style={{ fontSize: "0.75rem", background: "#ff8c0022", border: "1px solid #ff8c0044", borderRadius: 4, padding: "0.2rem 0.5rem", color: "#ff8c00" }}>
                          {liveData.race_control.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    {liveData.state === "live" && (
                      <div style={{ fontSize: "0.78rem", color: muted }}>
                        Lap <span style={{ color: text }}>{liveData.laps_done}</span> / {liveData.total_laps}
                        <span style={{ marginLeft: "0.75rem", color: accent }}>{liveData.race_progress}% complete</span>
                      </div>
                    )}
                    {liveData.state === "pre_race" && (
                      <span style={{ fontSize: "0.75rem", color: muted }}>Showing ML pre-race prediction</span>
                    )}
                  </div>
                  {liveData.state === "live" && (
                    <div style={{ marginTop: "0.75rem", height: 4, background: "#1a1a24", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${liveData.race_progress}%`, background: "#00ff88", borderRadius: 99, transition: "width 1s ease" }} />
                    </div>
                  )}
                </Card>

                {/* Driver list */}
                {(liveData.predictions || []).slice(0, 10).map((d, i) => {
                  const info = getDriverInfo(d.driver);
                  const driverColor = info.color || "#e10600";
                  const compound = d.tyre_compound;
                  const compoundColor = { SOFT: "#e10600", MEDIUM: "#f5c518", HARD: "#f0f0f0", INTER: "#00a86b", WET: "#4488ff" }[compound] || muted;
                  const isLive = liveData.state === "live";
                  return (
                    <Card key={d.driver || i} style={{ marginBottom: "0.5rem", borderColor: i === 0 ? driverColor + "44" : border }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                        {/* Position */}
                        <span style={{ color: i < 3 ? [accent,"#C0C0C0","#CD7F32"][i] : muted, fontFamily: "monospace", fontSize: "0.85rem", width: 22, flexShrink: 0 }}>
                          P{isLive ? d.position : i + 1}
                        </span>
                        <DriverAvatar driverId={d.driver} name={info.name || d.driver} size={40} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.15rem" }}>
                            <span style={{ fontSize: "0.82rem" }}>{info.nationality || ""}</span>
                            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{info.name || d.driver}</span>
                          </div>
                          <div style={{ fontSize: "0.72rem", color: muted, marginBottom: "0.3rem" }}>{d.team}</div>
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                            {isLive && d.gap_to_leader !== undefined && d.gap_to_leader !== null && (
                              <span style={{ fontSize: "0.68rem", background: "#1a1a2e", borderRadius: 4, padding: "0.15rem 0.4rem", color: "#aaa" }}>
                                {d.gap_to_leader === 0 ? "LEADER" : `+${typeof d.gap_to_leader === 'number' ? d.gap_to_leader.toFixed(1) : d.gap_to_leader}s`}
                              </span>
                            )}
                            {isLive && compound && (
                              <span style={{ fontSize: "0.68rem", background: `${compoundColor}22`, border: `1px solid ${compoundColor}44`, borderRadius: 4, padding: "0.15rem 0.4rem", color: compoundColor }}>
                                {compound} ({d.tyre_age} laps)
                              </span>
                            )}
                            {isLive && d.lap > 0 && (
                              <span style={{ fontSize: "0.68rem", background: "#1a1a2e", borderRadius: 4, padding: "0.15rem 0.4rem", color: "#aaa" }}>Lap {d.lap}</span>
                            )}
                            {!isLive && d.qualifying_position && (
                              <span style={{ fontSize: "0.68rem", background: "#1a1a2e", borderRadius: 4, padding: "0.15rem 0.4rem", color: "#aaa" }}>P{d.qualifying_position} quali</span>
                            )}
                          </div>
                          <div style={{ height: 4, background: "#1a1a24", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(100, (d.win_probability || 0) * 1.5)}%`, background: driverColor, borderRadius: 99, transition: "width 1s ease" }} />
                          </div>
                        </div>
                        <div style={{ background: `${driverColor}22`, border: `1px solid ${driverColor}44`, borderRadius: 8, padding: "0.4rem 0.6rem", textAlign: "center", flexShrink: 0, minWidth: 52 }}>
                          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: driverColor }}>{d.win_probability || 0}%</div>
                          <div style={{ fontSize: "0.6rem", color: muted }}>win</div>
                        </div>
                      </div>
                    </Card>
                  );
                })}

                <div style={{ fontSize: "0.72rem", color: muted, marginTop: "0.75rem" }}>
                  {liveData.state === "live"
                    ? `* Live probabilities blend ML pre-race prediction with current position, gap and tyre data. Updates every 15s.`
                    : "* Pre-race ML prediction based on championship model + qualifying grid. Will update live once race starts."}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── LIVE TIMING TAB ── */}
        {tab === "timing" && <LiveTimingTab />}

      </div>
    </div>
  );
}
