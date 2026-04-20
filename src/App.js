import { useState, useEffect } from "react";
import StandingsTab      from "./components/StandingsTab";
import ChampionshipTab   from "./components/ChampionshipTab";
import RacePredictorTab  from "./components/RacePredictorTab";
import LiveTimingTab     from "./components/LiveTimingTab";
import RaceReplayTab     from "./components/RaceReplayTab";
import {
  API_URL, ERGAST, TOTAL_ROUNDS, COMPLETED_ROUNDS,
  initialDrivers, initialConstructors, theme,
} from "./constants";

const { bg, accent, border, muted, text } = theme;

const TABS = [
  { id: "standings",  label: "Standings" },
  { id: "predict",    label: "Championship Prediction" },
  { id: "race",       label: "Race Predictor" },
  { id: "timing",     label: "Live Timing" },
  { id: "replay",     label: "Race Replay" },
];

export default function F1Tracker() {
  const [tab,             setTab]             = useState("standings");
  const [drivers,         setDrivers]         = useState(initialDrivers);
  const [constructors,    setConstructors]    = useState(initialConstructors);
  const [mlPredictions,   setMlPredictions]   = useState([]);
  const [schedule,        setSchedule]        = useState([]);
  const [selectedRace,    setSelectedRace]    = useState(0);
  const [raceMlPreds,     setRaceMlPreds]     = useState([]);
  const [loadingRace,     setLoadingRace]     = useState(false);
  const [liveData,        setLiveData]        = useState(null);
  const [liveRound,       setLiveRound]       = useState(1);
  const [liveLoading,     setLiveLoading]     = useState(false);
  const [mobileMenuOpen,  setMobileMenuOpen]  = useState(false); // eslint-disable-line no-unused-vars

  // Initial data fetches
  useEffect(() => {
    fetch(`${ERGAST}/2026/driverStandings.json`)
      .then(r => r.json())
      .then(data => {
        const standings = data.MRData.StandingsTable.StandingsLists[0].DriverStandings;
        setDrivers(standings.map(entry => ({
          id: entry.Driver.code,
          name: `${entry.Driver.givenName} ${entry.Driver.familyName}`,
          team: entry.Constructors[0].name,
          pts: parseInt(entry.points),
          color: initialDrivers.find(d => d.id === entry.Driver.code)?.color ?? "#888",
          nationality: initialDrivers.find(d => d.id === entry.Driver.code)?.nationality ?? "🏁",
          ratings: initialDrivers.find(d => d.id === entry.Driver.code)?.ratings ?? { pace:80, consistency:80, racecraft:80, qualifying:80, wet:80 },
          raceHistory: [parseInt(entry.points)],
        })));
      }).catch(() => {});

    fetch(`${ERGAST}/2026/constructorStandings.json`)
      .then(r => r.json())
      .then(data => {
        const cData = data.MRData.StandingsTable.StandingsLists[0].ConstructorStandings;
        setConstructors(cData.map(entry => ({
          id: entry.Constructor.constructorId,
          name: entry.Constructor.name,
          pts: parseInt(entry.points),
          color: initialConstructors.find(c => c.name === entry.Constructor.name)?.color ?? "#888",
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

  // Race predictor fetch
  useEffect(() => {
    if (schedule.length === 0) return;
    const race = schedule[selectedRace];
    if (!race) return;
    setLoadingRace(true);
    setRaceMlPreds([]);
    fetch(`${API_URL}/api/race/${race.round}`)
      .then(r => r.json())
      .then(data => { setRaceMlPreds(data.predictions || []); setLoadingRace(false); })
      .catch(() => setLoadingRace(false));
  }, [selectedRace, schedule]);

  // Live race fetch
  useEffect(() => {
    if (tab !== "race") return;
    setLiveLoading(true);
    const fetchLive = () => {
      fetch(`${API_URL}/api/race/live/${liveRound}`)
        .then(r => r.json())
        .then(data => { setLiveData(data); setLiveLoading(false); })
        .catch(() => setLiveLoading(false));
    };
    fetchLive();
    const id = setInterval(fetchLive, 15000);
    return () => clearInterval(id);
  }, [tab, liveRound]);

  const leader = drivers[0];

  return (
    <div style={{ background: bg, minHeight: "100vh", color: text }}>

      {/* ── TOP NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "#080810",
        borderBottom: `1px solid ${border}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 1.5rem", display: "flex", alignItems: "stretch", height: 52 }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginRight: "2rem", flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, background: accent, borderRadius: 4,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: "0.75rem", color: "#fff", letterSpacing: "-0.05em",
            }}>F1</div>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1 }}>INTELLIGENCE</div>
              <div style={{ fontSize: "0.55rem", color: muted, letterSpacing: "0.15em", fontFamily: "monospace" }}>2026 SEASON</div>
            </div>
          </div>

          {/* Desktop tabs */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 0, flex: 1, overflowX: "auto" }}>
            {TABS.map(t => (
              <button
                key={t.id}
                className={`tab-btn${tab === t.id ? " active" : ""}`}
                onClick={() => { setTab(t.id); setMobileMenuOpen(false); }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status pill */}
          {leader && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", paddingLeft: "1rem", flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.62rem", color: muted, fontFamily: "monospace", letterSpacing: "0.12em" }}>
                  R{COMPLETED_ROUNDS}/{TOTAL_ROUNDS}
                </div>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: leader.color || accent }}>
                  {leader.name?.split(" ").pop()} {leader.pts}pts
                </div>
              </div>
              <div style={{ width: 1, height: 28, background: border }} />
            </div>
          )}
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Page title */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: "clamp(1.5rem, 3vw, 2.2rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {TABS.find(t => t.id === tab)?.label}
            </h1>
            {tab === "standings" && leader && (
              <span style={{ fontSize: "0.78rem", color: muted, paddingTop: "0.2rem" }}>
                Leader: <span style={{ color: leader.color || accent, fontWeight: 600 }}>{leader.name}</span> — {leader.pts} pts
              </span>
            )}
          </div>
          {/* Season progress */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.75rem" }}>
            <div style={{ flex: 1, maxWidth: 300, height: 3, background: "#1a1a24", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(COMPLETED_ROUNDS / TOTAL_ROUNDS) * 100}%`, background: accent, borderRadius: 99, transition: "width 1s ease" }} />
            </div>
            <span style={{ fontSize: "0.68rem", color: muted, fontFamily: "monospace" }}>
              ROUND {COMPLETED_ROUNDS} OF {TOTAL_ROUNDS}
            </span>
          </div>
        </div>

        {/* Tab content */}
        {tab === "standings" && (
          <StandingsTab drivers={drivers} constructors={constructors} />
        )}
        {tab === "predict" && (
          <ChampionshipTab drivers={drivers} mlPredictions={mlPredictions} />
        )}
        {tab === "race" && (
          <RacePredictorTab
            schedule={schedule}
            selectedRace={selectedRace}
            setSelectedRace={setSelectedRace}
            drivers={drivers}
            raceMlPredictions={raceMlPreds}
            loadingRace={loadingRace}
            liveData={liveData}
            liveRound={liveRound}
            setLiveRound={setLiveRound}
            liveLoading={liveLoading}
          />
        )}
        {tab === "timing" && <LiveTimingTab />}
        {tab === "replay" && <RaceReplayTab />}
      </main>
    </div>
  );
}
