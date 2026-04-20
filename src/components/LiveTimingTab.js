import { useState, useEffect, useRef, useCallback } from "react";
import { SectionLabel } from "./ui";
import { ERGAST, OF1, COUNTRY_FLAGS, COMP_COLOR, theme } from "../constants";

const { accent, border } = theme;

const CW = 900, CH = 500, PAD = 24;

function normalizePt(raw, bounds) {
  if (!bounds) return null;
  const { minX, w, minY, h } = bounds;
  const x = PAD + ((raw.x - minX) / w) * (CW - PAD * 2);
  const y = PAD + (1 - (raw.y - minY) / h) * (CH - PAD * 2);
  if (!isFinite(x) || !isFinite(y)) return null;
  return { x, y };
}

function drawTrack(ctx, trackPts, bounds) {
  if (!trackPts.length || !bounds) return;
  ctx.clearRect(0, 0, CW, CH);
  ctx.save();
  ctx.strokeStyle = "#1e1e30";
  ctx.lineWidth = 14;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  trackPts.forEach((raw, i) => {
    const pt = normalizePt(raw, bounds);
    if (!pt) return;
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = "#3c3c58";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

function drawDrivers(ctx, dots, driverMap, bounds, hoveredNum) {
  ctx.clearRect(0, 0, CW, CH);
  if (!bounds) return;

  Object.entries(dots).forEach(([num, raw]) => {
    const pt = normalizePt(raw, bounds);
    if (!pt) return;
    const drv = driverMap[num] || {};
    const col = drv.team_colour ? `#${drv.team_colour}` : "#888";
    const code = drv.name_acronym || num;
    const isHov = hoveredNum === num;

    ctx.save();
    if (isHov) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = col + "30";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, isHov ? 8 : 6, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    ctx.font = `bold 9px monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = col;
    ctx.fillText(code, pt.x, pt.y - 10);
    ctx.restore();
  });
}

const SEG_CLR = { 0: "#1a1a28", 2048: "#f5c518", 2049: "#00e472", 2050: "#b020f5", 2051: "#e10600", 2052: "#e10600" };

function formatLap(s) {
  if (!s) return "—";
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, "0")}`;
}

export default function LiveTimingTab() {
  const [allRaces,     setAllRaces]     = useState([]);
  const [of1Sessions,  setOf1Sessions]  = useState([]);
  const [selectedRace, setSelectedRace] = useState(null);
  const [sessionData,  setSessionData]  = useState(null);
  const [isLive,       setIsLive]       = useState(false);
  const [loadingInit,  setLoadingInit]  = useState(true);
  const [loadingData,  setLoadingData]  = useState(false);

  const [ergastResults, setErgastResults] = useState([]);
  const [of1Drivers,    setOf1Drivers]    = useState({});
  const [stints,        setStints]        = useState({});
  const [lapTimes,      setLapTimes]      = useState({});
  const [livePositions, setLivePositions] = useState({});
  const [liveIntervals, setLiveIntervals] = useState({});
  const [raceControl,   setRaceControl]   = useState([]);
  const [driverDots,    setDriverDots]    = useState({});
  const [trackPts,      setTrackPts]      = useState([]);
  const [trackBounds,   setTrackBounds]   = useState(null);
  const [hoveredNum,    setHoveredNum]    = useState(null);
  const [tooltipPos,    setTooltipPos]    = useState(null);

  const bgCanvasRef = useRef(null);
  const fgCanvasRef = useRef(null);
  const rafRef      = useRef(null);
  const dotsRef     = useRef({});
  const drvMapRef   = useRef({});
  const boundsRef   = useRef(null);
  const hovRef      = useRef(null);

  // Keep refs in sync
  useEffect(() => { dotsRef.current = driverDots; }, [driverDots]);
  useEffect(() => { drvMapRef.current = of1Drivers; }, [of1Drivers]);
  useEffect(() => { boundsRef.current = trackBounds; }, [trackBounds]);
  useEffect(() => { hovRef.current = hoveredNum; }, [hoveredNum]);

  // Draw track on bg canvas whenever track changes
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas || !trackPts.length || !trackBounds) return;
    const ctx = canvas.getContext("2d");
    drawTrack(ctx, trackPts, trackBounds);
  }, [trackPts, trackBounds]);

  // RAF loop for driver dots
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const canvas = fgCanvasRef.current;
      if (canvas && boundsRef.current) {
        const ctx = canvas.getContext("2d");
        drawDrivers(ctx, dotsRef.current, drvMapRef.current, boundsRef.current, hovRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelled = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

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

  // Effect 2: match race to session
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
    setDriverDots({}); setTrackPts([]); setTrackBounds(null);
  }, [selectedRace, of1Sessions]);

  // Effect 3: load race data
  useEffect(() => {
    if (!sessionData || !selectedRace) return;
    let dead = false;
    setLoadingData(true);
    const sk = sessionData.session_key;
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

        const lapMap = {};
        (Array.isArray(lapR) ? lapR : []).forEach(l => {
          const k = String(l.driver_number);
          if (l.lap_duration && (!lapMap[k] || l.lap_number > lapMap[k].lap_number)) lapMap[k] = l;
        });
        setLapTimes(lapMap);

        // Track outline
        if (drvsArr.length > 0 && !dead) {
          const t0 = new Date(sessionData.date_start);
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
              break;
            }
          }
        }

        // Final driver positions
        if (!isLive && !dead && sessionData.date_end) {
          const dateEnd  = new Date(sessionData.date_end);
          const snapFrom = new Date(dateEnd.getTime() - 120000).toISOString();
          const snapTo   = new Date(dateEnd.getTime() + 30000).toISOString();
          try {
            const snapD = await fetch(`${OF1}/location?session_key=${sk}&date>${snapFrom}&date<${snapTo}`).then(r => r.json());
            if (!dead && Array.isArray(snapD)) {
              const latest = {};
              snapD.forEach(loc => {
                const k = String(loc.driver_number);
                if (!latest[k] || loc.date > latest[k].date) latest[k] = loc;
              });
              setDriverDots(latest);
              dotsRef.current = latest;
            }
          } catch (_) {}
        }
      } catch (_) {}
      if (!dead) setLoadingData(false);
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.session_key]);

  // Effect 4: live polling
  useEffect(() => {
    if (!sessionData || !isLive) return;
    const sk = sessionData.session_key;
    const poll = async () => {
      const since = new Date(Date.now() - 10000).toISOString();
      try {
        const [posR, intR, rcR, locR, lapR, stR] = await Promise.all([
          fetch(`${OF1}/position?session_key=${sk}&date>${since}`),
          fetch(`${OF1}/intervals?session_key=${sk}&date>${since}`),
          fetch(`${OF1}/race_control?session_key=${sk}`),
          fetch(`${OF1}/location?session_key=${sk}&date>${new Date(Date.now()-5000).toISOString()}`),
          fetch(`${OF1}/laps?session_key=${sk}`),
          fetch(`${OF1}/stints?session_key=${sk}`),
        ]);
        const [posD, intD, rcD, locD, lapD, stD] = await Promise.all([posR, intR, rcR, locR, lapR, stR].map(r => r.json()));

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
        dotsRef.current = dotLatest;

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

  // Leaderboard
  const codeToNum = {};
  Object.entries(of1Drivers).forEach(([num, d]) => { if (d.name_acronym) codeToNum[d.name_acronym.toUpperCase()] = num; });

  const leaderboard = isLive
    ? Object.keys(of1Drivers).map(num => {
        const drv = of1Drivers[num];
        const pos = livePositions[num];
        const intv = liveIntervals[num];
        const lap = lapTimes[num];
        const stint = stints[num];
        const lapN = lap?.lap_number || 0;
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
        const code = r.Driver.code.toUpperCase();
        const num = codeToNum[code];
        const drv = num ? of1Drivers[num] : null;
        const stint = num ? stints[num] : null;
        const lap = num ? lapTimes[num] : null;
        const lapN = lap?.lap_number || 0;
        return {
          num, position: parseInt(r.position),
          code: r.Driver.code,
          fullName: `${r.Driver.givenName} ${r.Driver.familyName}`,
          teamColor: drv?.team_colour ? `#${drv.team_colour}` : "#888",
          team: r.Constructor.name,
          gap: i === 0 ? (r.Time?.time || "Winner") : (r.Time?.time ? `+${r.Time.time}` : r.status || "—"),
          lastLap: lap?.lap_duration,
          segments: [...(lap?.segments_sector_1||[]),...(lap?.segments_sector_2||[]),...(lap?.segments_sector_3||[])].flat(),
          compound: stint?.compound || "",
          tyreAge: lapN > 0 && stint?.lap_start ? lapN - stint.lap_start + 1 : 0,
        };
      });

  const flagStatus = (() => {
    for (const msg of raceControl) {
      const f = (msg.flag || "").toUpperCase(), c = (msg.category || "").toUpperCase();
      if (f === "RED" || c.includes("RED FLAG"))          return { label: "RED FLAG", color: "#e10600" };
      if (f.includes("SAFETY") || c.includes("SAFETY"))  return { label: "SAFETY CAR", color: "#ff8c00" };
      if (f.includes("VIRTUAL") || c.includes("VIRTUAL")) return { label: "VIRTUAL SAFETY CAR", color: "#f5c518" };
    }
    return null;
  })();

  // Canvas mouse handling
  const handleCanvasMouseMove = useCallback((e) => {
    if (!boundsRef.current || !fgCanvasRef.current) return;
    const rect = fgCanvasRef.current.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let closestNum = null, closestDist = 20;
    Object.entries(dotsRef.current).forEach(([num, raw]) => {
      const pt = normalizePt(raw, boundsRef.current);
      if (!pt) return;
      const d = Math.hypot(mx - pt.x, my - pt.y);
      if (d < closestDist) { closestDist = d; closestNum = num; }
    });
    setHoveredNum(closestNum);
    setTooltipPos(closestNum ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
  }, []);

  const handleCanvasMouseLeave = useCallback(() => {
    setHoveredNum(null);
    setTooltipPos(null);
  }, []);

  if (loadingInit) return (
    <div style={{ textAlign: "center", padding: "5rem", color: "#444", fontFamily: "monospace", fontSize: "0.8rem" }}>
      Loading schedule...
    </div>
  );

  if (allRaces.length === 0) return (
    <div style={{ textAlign: "center", padding: "5rem", color: "#444", fontFamily: "monospace", fontSize: "0.8rem" }}>
      No completed 2026 races yet.
    </div>
  );

  const hoveredEntry = hoveredNum ? leaderboard.find(d => d.num === hoveredNum) : null;

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
                {isLive && selectedRace?.round === race.round && (
                  <span style={{ marginLeft: "0.4rem", color: "#00ff88", fontSize: "0.6rem", animation: "pulseRed 1.5s infinite" }}>● LIVE</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!sessionData && !loadingData && (
        <div style={{ color: "#444", textAlign: "center", padding: "3rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
          Select a race to load timing data.
        </div>
      )}

      {loadingData && (
        <div style={{ color: "#444", textAlign: "center", padding: "3rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
          Loading race data from OpenF1...
        </div>
      )}

      {sessionData && !loadingData && (
        <>
          {/* Flag banner */}
          {flagStatus && (
            <div style={{
              background: `${flagStatus.color}18`, border: `1px solid ${flagStatus.color}77`,
              borderRadius: 8, padding: "0.65rem 1rem", marginBottom: "1rem",
              display: "flex", alignItems: "center", gap: "0.75rem",
            }}>
              <div style={{ width: 10, height: 10, background: flagStatus.color, borderRadius: 2, boxShadow: `0 0 8px ${flagStatus.color}`, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: flagStatus.color, fontSize: "0.88rem", letterSpacing: "0.12em", fontFamily: "monospace" }}>
                {flagStatus.label}
              </span>
            </div>
          )}

          {/* Session header */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: isLive ? "#00ff88" : "#333",
              ...(isLive ? { animation: "pulse 1.5s infinite" } : {}),
            }} />
            <span style={{ fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.1em", fontFamily: "monospace", color: isLive ? "#00ff88" : "#555" }}>
              {isLive ? "LIVE" : "RESULT"}
            </span>
            <span style={{ color: "#888", fontSize: "0.82rem" }}>
              {selectedRace?.raceName} — {sessionData.circuit_short_name}
            </span>
          </div>

          {/* Canvas map + leaderboard */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "1.5rem", alignItems: "start" }}>
            {/* Leaderboard */}
            <div>
              <SectionLabel>{isLive ? "Live Leaderboard" : "Race Result"}</SectionLabel>
              <div style={{ display: "flex", gap: "0.5rem", padding: "0 0.7rem 0.4rem", fontSize: "0.58rem", color: "#3a3a4a", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "monospace" }}>
                <span style={{ width: 22 }}>P</span>
                <span style={{ flex: 1 }}>Driver</span>
                <span style={{ width: 96, textAlign: "right" }}>Gap / Time</span>
                <span style={{ width: 80, textAlign: "right" }}>Last Lap</span>
                <span style={{ width: 48, textAlign: "center" }}>Tyre</span>
              </div>

              {leaderboard.length === 0 && (
                <div style={{ color: "#333", textAlign: "center", padding: "2rem", fontSize: "0.82rem" }}>No data yet...</div>
              )}

              {leaderboard.map((d, i) => {
                const cColor = COMP_COLOR[d.compound] || "#555";
                const posColor = i === 0 ? accent : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#555";
                return (
                  <div key={d.num || i} style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.5rem 0.7rem",
                    background: i % 2 === 0 ? "#12121a" : "#0e0e17",
                    borderLeft: `3px solid ${d.teamColor}`,
                    marginBottom: 2, borderRadius: 4,
                  }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.82rem", width: 22, flexShrink: 0, color: posColor, fontWeight: 700 }}>
                      {d.position}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.83rem", color: d.teamColor }}>{d.code}</span>
                        <span style={{ fontSize: "0.67rem", color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
                          {d.fullName}
                        </span>
                      </div>
                      {d.segments.length > 0 && (
                        <div style={{ display: "flex", gap: 1.5, marginTop: 3 }}>
                          {d.segments.slice(0, 18).map((seg, si) => (
                            <div key={si} style={{ width: 5, height: 3, borderRadius: 1, flexShrink: 0, background: SEG_CLR[seg] ?? SEG_CLR[0] }} />
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ width: 96, textAlign: "right", flexShrink: 0 }}>
                      <span style={{ fontSize: "0.73rem", fontFamily: "monospace", color: i === 0 ? "#00e472" : "#aaa" }}>
                        {d.gap ?? "—"}
                      </span>
                    </div>
                    <div style={{ width: 80, textAlign: "right", flexShrink: 0 }}>
                      <span style={{ fontSize: "0.71rem", fontFamily: "monospace", color: "#bbb" }}>
                        {formatLap(d.lastLap)}
                      </span>
                    </div>
                    <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>
                      {d.compound ? (
                        <>
                          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: cColor, background: `${cColor}18`, border: `1px solid ${cColor}50`, borderRadius: 4, padding: "0.1rem 0.25rem", display: "inline-block" }}>
                            {d.compound[0]}
                          </div>
                          {d.tyreAge > 0 && <div style={{ fontSize: "0.57rem", color: "#555", marginTop: 1 }}>{d.tyreAge}L</div>}
                        </>
                      ) : <span style={{ color: "#333" }}>—</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Canvas map */}
            <div>
              <SectionLabel>Circuit Map</SectionLabel>
              <div style={{ background: "#0d0d16", border: `1px solid ${border}`, borderRadius: 10, padding: "0.5rem", position: "relative" }}>
                <div style={{ position: "relative", width: "100%", aspectRatio: `${CW}/${CH}` }}>
                  <canvas ref={bgCanvasRef} width={CW} height={CH}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: 8 }} />
                  <canvas ref={fgCanvasRef} width={CW} height={CH}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: 8, cursor: "crosshair" }}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={handleCanvasMouseLeave}
                  />
                  {!trackPts.length && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: "0.75rem", fontFamily: "monospace" }}>
                      {loadingData ? "Loading track..." : "No GPS data"}
                    </div>
                  )}
                  {/* Tooltip */}
                  {hoveredNum && hoveredEntry && tooltipPos && (
                    <div style={{
                      position: "absolute",
                      left: tooltipPos.x + 12, top: tooltipPos.y - 12,
                      background: "#0a0a12", border: `1px solid ${hoveredEntry.teamColor}55`,
                      borderLeft: `3px solid ${hoveredEntry.teamColor}`,
                      borderRadius: 6, padding: "0.35rem 0.55rem",
                      fontSize: "0.62rem", color: "#ccc", fontFamily: "monospace",
                      whiteSpace: "nowrap", pointerEvents: "none", zIndex: 10,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.8)",
                    }}>
                      <div style={{ fontWeight: 700, color: hoveredEntry.teamColor, marginBottom: 2 }}>
                        {hoveredEntry.code} · {hoveredEntry.fullName}
                      </div>
                      <div style={{ color: "#666" }}>P{hoveredEntry.position}{hoveredEntry.gap ? ` · ${hoveredEntry.gap}` : ""}</div>
                      {hoveredEntry.lastLap && <div style={{ color: "#aaa" }}>Lap {formatLap(hoveredEntry.lastLap)}</div>}
                      {hoveredEntry.compound && (
                        <div style={{ color: COMP_COLOR[hoveredEntry.compound] || "#888" }}>
                          {hoveredEntry.compound[0]} tyre{hoveredEntry.tyreAge > 0 ? ` · ${hoveredEntry.tyreAge}L` : ""}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "0.58rem", color: "#333", marginTop: 4, textAlign: "center", fontFamily: "monospace" }}>
                  {Object.keys(driverDots).length > 0
                    ? `${isLive ? "Live" : "Final"} — ${Object.keys(driverDots).length} drivers`
                    : trackPts.length ? "Fetching positions..." : ""}
                </div>
              </div>

              {/* Sector key */}
              <div style={{ background: "#12121a", border: `1px solid ${border}`, borderRadius: 8, padding: "0.75rem 1rem", marginTop: "0.85rem" }}>
                <SectionLabel style={{ marginBottom: "0.5rem" }}>Sector Key</SectionLabel>
                {[["#b020f5","Fastest overall"],["#00e472","Personal best"],["#f5c518","No improvement"]].map(([col,lbl]) => (
                  <div key={lbl} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                    <div style={{ width: 16, height: 6, borderRadius: 2, background: col, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.7rem", color: "#777" }}>{lbl}</span>
                  </div>
                ))}
              </div>

              {/* Race control */}
              {raceControl.length > 0 && (
                <div style={{ marginTop: "0.85rem" }}>
                  <SectionLabel>Race Control</SectionLabel>
                  {raceControl.slice(0, 5).map((msg, i) => (
                    <div key={i} style={{
                      background: "#12121a", border: `1px solid ${border}`,
                      borderLeft: i === 0 ? `2px solid ${accent}55` : `2px solid ${border}`,
                      borderRadius: 6, padding: "0.4rem 0.65rem", marginBottom: 4,
                      fontSize: "0.68rem", color: i === 0 ? "#aaa" : "#444",
                    }}>
                      {msg.message || "—"}
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
