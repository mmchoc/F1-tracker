import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const TOTAL_ROUNDS = 24;
const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const COMPLETED_ROUNDS = 1;
const REMAINING_ROUNDS = TOTAL_ROUNDS - COMPLETED_ROUNDS;

const DRIVER_IMAGES = {
  RUS: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/1col/image.png",
  ANT: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/K/KIMANT01_Kimi_Antonelli/kimant01.png.transform/1col/image.png",
  LEC: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CHALEC16_Charles_Leclerc/chalec16.png.transform/1col/image.png",
  HAM: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/1col/image.png",
  NOR: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/1col/image.png",
  VER: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png",
  PIA: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png.transform/1col/image.png",
  SAI: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CARSAI55_Carlos_Sainz/carsai55.png.transform/1col/image.png",
  ALB: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ALEALB23_Alexander_Albon/alealb23.png.transform/1col/image.png",
  GAS: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/P/PIEGAS10_Pierre_Gasly/piegas10.png.transform/1col/image.png",
  ALO: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FERALO14_Fernando_Alonso/feralo14.png.transform/1col/image.png",
  STR: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANSTR18_Lance_Stroll/lanstr18.png.transform/1col/image.png",
  HUL: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/N/NICHUL27_Nico_Hulkenberg/nichul27.png.transform/1col/image.png",
  BEA: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OLIBEA38_Oliver_Bearman/olibea38.png.transform/1col/image.png",
  HAD: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png.transform/1col/image.png",
  LIN: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ARVLIN01_Arvid_Lindblad/arvlin01.png.transform/1col/image.png",
  BOR: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GABBOR01_Gabriel_Bortoleto/gabbor01.png.transform/1col/image.png",
  COL: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FRACOL43_Franco_Colapinto/fracol43.png.transform/1col/image.png",
  LAW: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png.transform/1col/image.png",
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
      style={{
        width: size, height: size, borderRadius: "50%",
        objectFit: "cover", objectPosition: "top",
        background: "#1f1f2e", flexShrink: 0,
      }}
    />
  );
};

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
            <span style={{ fontSize: "0.78rem", color: muted }}>Round <span style={{ color: "#fff" }}>1</span> / 24 complete</span>
            <span style={{ fontSize: "0.78rem", color: muted }}>Leader: <span style={{ color: "#00D2BE" }}>G. Russell</span> — 25 pts</span>
            <span style={{ fontSize: "0.78rem", color: muted }}>Last: <span style={{ color: accent }}>🇦🇺 Australian GP</span></span>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {[["standings","Standings"],["constructors","Constructors"],["predict","Championship Prediction"],["race","Race Predictor"],["live","🔴 Live Race"],["build","How to Build This"]].map(([id,label]) => (
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

        {/* ── HOW TO BUILD THIS TAB ── */}
        {tab === "build" && (
          <div>
            <SectionTitle>Your F1 App — The Tech Stack</SectionTitle>
            {[
              { phase: "Phase 1", title: "Get the Data", color: "#FF6B35", desc: "Your app lives or dies by its data. Use the Jolpica API (free, updated after every GP).", items: ["Jolpica F1 API — free, 70+ years of data", "FastF1 (Python library) — telemetry, lap times, tire data", "OpenF1 API — live timing & positional data", "Learn: REST APIs, fetch(), JSON parsing"] },
              { phase: "Phase 2", title: "Build the Frontend", color: "#F7B731", desc: "React is perfect for dynamic dashboards. Add Recharts for visualizations.", items: ["React (component-based UI)", "Recharts for charts and graphs", "CSS / Tailwind for styling", "Learn: React state, useEffect for data fetching"] },
              { phase: "Phase 3", title: "Build the Prediction Model", color: "#26C6DA", desc: "Random Forest trained on 2010–2025 F1 data + FastF1 pace ratings.", items: ["Python + Pandas for data wrangling", "Scikit-learn for Random Forest model", "FastF1 for lap time and pace data", "FastAPI to serve predictions to React"] },
              { phase: "Phase 4", title: "Connect it All", color: "#AB47BC", desc: "Build a backend that fetches new data after each GP and serves it to your frontend.", items: ["FastAPI Python backend", "PostgreSQL database for race history", "Scheduled jobs to retrain after each race", "Deploy to Vercel + your own server"] },
            ].map(p => (
              <Card key={p.phase} style={{ marginBottom: "0.75rem", borderLeft: `3px solid ${p.color}` }}>
                <div>
                  <div style={{ fontSize: "0.65rem", color: p.color, letterSpacing: "0.15em", fontFamily: "monospace" }}>{p.phase}</div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", margin: "0.15rem 0" }}>{p.title}</div>
                  <div style={{ fontSize: "0.8rem", color: muted, marginBottom: "0.75rem", lineHeight: 1.5 }}>{p.desc}</div>
                  {p.items.map(item => (
                    <div key={item} style={{ fontSize: "0.8rem", color: "#c0bdb5", padding: "0.3rem 0", borderTop: `1px solid ${border}`, display: "flex", gap: "0.5rem" }}>
                      <span style={{ color: p.color, flexShrink: 0 }}>›</span>{item}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
