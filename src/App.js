import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StandingsTab      from "./components/StandingsTab";
import ChampionshipTab   from "./components/ChampionshipTab";
import RacePredictorTab  from "./components/RacePredictorTab";
import LiveTimingTab     from "./components/LiveTimingTab";
import RaceReplayTab     from "./components/RaceReplayTab";
import {
  API_URL, ERGAST, TOTAL_ROUNDS, COMPLETED_ROUNDS,
  initialDrivers, initialConstructors,
} from "./constants";

const accent = "#e10600";
const TABS = [
  { id: "standings", label: "Standings"              },
  { id: "predict",   label: "Championship"            },
  { id: "race",      label: "Race Predictor"          },
  { id: "timing",    label: "Live Timing"             },
  { id: "replay",    label: "Race Replay"             },
];

export default function F1Tracker() {
  const [tab,           setTab]           = useState("standings");
  const [drivers,       setDrivers]       = useState(initialDrivers);
  const [constructors,  setConstructors]  = useState(initialConstructors);
  const [mlPredictions, setMlPredictions] = useState([]);
  const [schedule,      setSchedule]      = useState([]);
  const [selectedRace,  setSelectedRace]  = useState(0);
  const [raceMlPreds,   setRaceMlPreds]   = useState([]);
  const [loadingRace,   setLoadingRace]   = useState(false);
  const [liveData,      setLiveData]      = useState(null);
  const [liveRound,     setLiveRound]     = useState(1);
  const [liveLoading,   setLiveLoading]   = useState(false);

  useEffect(() => {
    fetch(`${ERGAST}/2026/driverStandings.json`)
      .then(r => r.json())
      .then(data => {
        const s = data.MRData.StandingsTable.StandingsLists[0].DriverStandings;
        setDrivers(s.map(e => ({
          id: e.Driver.code,
          name: `${e.Driver.givenName} ${e.Driver.familyName}`,
          team: e.Constructors[0].name,
          pts: parseInt(e.points),
          color: initialDrivers.find(d => d.id === e.Driver.code)?.color ?? "#888",
          nationality: initialDrivers.find(d => d.id === e.Driver.code)?.nationality ?? "🏁",
          ratings: initialDrivers.find(d => d.id === e.Driver.code)?.ratings ?? { pace:80, consistency:80, racecraft:80, qualifying:80, wet:80 },
          raceHistory: [parseInt(e.points)],
        })));
      }).catch(() => {});

    fetch(`${ERGAST}/2026/constructorStandings.json`)
      .then(r => r.json())
      .then(data => {
        const c = data.MRData.StandingsTable.StandingsLists[0].ConstructorStandings;
        setConstructors(c.map(e => ({
          id: e.Constructor.constructorId,
          name: e.Constructor.name,
          pts: parseInt(e.points),
          color: initialConstructors.find(c => c.name === e.Constructor.name)?.color ?? "#888",
          drivers: [],
        })));
      }).catch(() => {});

    fetch(`${API_URL}/api/championship`)
      .then(r => r.json())
      .then(d => setMlPredictions(d.predictions || []))
      .catch(() => {});

    fetch(`${API_URL}/api/schedule`)
      .then(r => r.json())
      .then(d => setSchedule((d.races || []).filter(r => r.round > COMPLETED_ROUNDS)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!schedule.length) return;
    const race = schedule[selectedRace];
    if (!race) return;
    setLoadingRace(true);
    setRaceMlPreds([]);
    fetch(`${API_URL}/api/race/${race.round}`)
      .then(r => r.json())
      .then(d => { setRaceMlPreds(d.predictions || []); setLoadingRace(false); })
      .catch(() => setLoadingRace(false));
  }, [selectedRace, schedule]);

  useEffect(() => {
    if (tab !== "race") return;
    setLiveLoading(true);
    const go = () => {
      fetch(`${API_URL}/api/race/live/${liveRound}`)
        .then(r => r.json())
        .then(d => { setLiveData(d); setLiveLoading(false); })
        .catch(() => setLiveLoading(false));
    };
    go();
    const id = setInterval(go, 15000);
    return () => clearInterval(id);
  }, [tab, liveRound]);

  const leader = drivers[0];

  return (
    <div style={{ background: "#050508", minHeight: "100vh", color: "#f0ece3" }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 200,
        background: "rgba(5,5,10,0.92)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "0 1px 0 rgba(225,6,0,0.12)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 1.5rem", display: "flex", alignItems: "stretch", height: 54 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginRight: "2.5rem", flexShrink: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 6, flexShrink: 0,
              background: "linear-gradient(135deg, #e10600 0%, #ff6b35 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: "0.72rem", color: "#fff", letterSpacing: "-0.04em",
              boxShadow: "0 0 12px rgba(225,6,0,0.4)",
            }}>F1</div>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.1 }}>INTELLIGENCE</div>
              <div style={{ fontSize: "0.52rem", color: "#555", letterSpacing: "0.2em", fontFamily: "monospace" }}>2026 SEASON</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", alignItems: "stretch", flex: 1, overflowX: "auto" }}>
            {TABS.map(t => (
              <button
                key={t.id}
                className={`tab-btn${tab === t.id ? " active" : ""}`}
                onClick={() => setTab(t.id)}
              >{t.label}</button>
            ))}
          </div>

          {/* Leader pill */}
          {leader && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingLeft: "1rem", flexShrink: 0 }}>
              <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.06)" }} />
              <div>
                <div style={{ fontSize: "0.56rem", color: "#444", fontFamily: "monospace", letterSpacing: "0.15em" }}>LEADER · R{COMPLETED_ROUNDS}/{TOTAL_ROUNDS}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: leader.color || accent }}>
                  {leader.name?.split(" ").pop()} · {leader.pts}pts
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Season progress stripe */}
        <div style={{ height: 2, background: "rgba(255,255,255,0.03)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(COMPLETED_ROUNDS / TOTAL_ROUNDS) * 100}%` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            style={{ height: "100%", background: `linear-gradient(90deg, ${accent}, #ff6b35)` }}
          />
        </div>
      </nav>

      {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
      <div style={{
        backgroundImage: `
          radial-gradient(ellipse 70% 80% at 15% -10%, rgba(225,6,0,0.12) 0%, transparent 55%),
          radial-gradient(ellipse 50% 60% at 85% 110%, rgba(255,107,53,0.06) 0%, transparent 55%),
          linear-gradient(rgba(225,6,0,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(225,6,0,0.025) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 100% 100%, 48px 48px, 48px 48px",
        padding: "2rem 1.5rem 0",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{ margin: 0, fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>
              {TABS.find(t => t.id === tab)?.label}
            </motion.h1>
            {tab === "standings" && leader && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                style={{ fontSize: "0.82rem", color: "#555" }}>
                Leader: <span style={{ color: leader.color || accent, fontWeight: 600 }}>{leader.name}</span>
              </motion.span>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "1.75rem 1.5rem 4rem" }}>
        <AnimatePresence mode="wait">
          {tab === "standings" && (
            <motion.div key="standings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <StandingsTab drivers={drivers} constructors={constructors} />
            </motion.div>
          )}
          {tab === "predict" && (
            <motion.div key="predict" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <ChampionshipTab drivers={drivers} mlPredictions={mlPredictions} />
            </motion.div>
          )}
          {tab === "race" && (
            <motion.div key="race" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <RacePredictorTab
                schedule={schedule} selectedRace={selectedRace} setSelectedRace={setSelectedRace}
                drivers={drivers} raceMlPredictions={raceMlPreds} loadingRace={loadingRace}
                liveData={liveData} liveRound={liveRound} setLiveRound={setLiveRound} liveLoading={liveLoading}
              />
            </motion.div>
          )}
          {tab === "timing" && (
            <motion.div key="timing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <LiveTimingTab />
            </motion.div>
          )}
          {tab === "replay" && (
            <motion.div key="replay" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <RaceReplayTab />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
