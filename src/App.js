import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Cell } from "recharts";

// ─── REAL DATA: After Round 1 – Australian GP 2026 ───────────────────────────
const TOTAL_ROUNDS = 24;
const COMPLETED_ROUNDS = 1;
const REMAINING_ROUNDS = TOTAL_ROUNDS - COMPLETED_ROUNDS;
const MAX_PTS_PER_RACE = 26; // 25 + fastest lap

const initialDrivers = [
  { id: "RUS", name: "George Russell",    team: "Mercedes",      pts: 25, color: "#00D2BE", nationality: "🇬🇧",
    ratings: { pace: 90, consistency: 88, racecraft: 85, qualifying: 92, wet: 82 },
    raceHistory: [25] },
  { id: "ANT", name: "Kimi Antonelli",    team: "Mercedes",      pts: 18, color: "#00D2BE", nationality: "🇮🇹",
    ratings: { pace: 86, consistency: 80, racecraft: 84, qualifying: 85, wet: 78 },
    raceHistory: [18] },
  { id: "LEC", name: "Charles Leclerc",   team: "Ferrari",       pts: 15, color: "#DC143C", nationality: "🇲🇨",
    ratings: { pace: 91, consistency: 83, racecraft: 86, qualifying: 94, wet: 81 },
    raceHistory: [15] },
  { id: "HAM", name: "Lewis Hamilton",    team: "Ferrari",       pts: 12, color: "#DC143C", nationality: "🇬🇧",
    ratings: { pace: 88, consistency: 85, racecraft: 93, qualifying: 88, wet: 92 },
    raceHistory: [12] },
  { id: "NOR", name: "Lando Norris",      team: "McLaren",       pts: 10, color: "#FF8000", nationality: "🇬🇧",
    ratings: { pace: 92, consistency: 86, racecraft: 87, qualifying: 90, wet: 88 },
    raceHistory: [10] },
  { id: "VER", name: "Max Verstappen",    team: "Red Bull",      pts: 8,  color: "#1E41FF", nationality: "🇳🇱",
    ratings: { pace: 95, consistency: 87, racecraft: 95, qualifying: 93, wet: 95 },
    raceHistory: [8] },
  { id: "BEA", name: "Oliver Bearman",    team: "Haas",          pts: 6,  color: "#FFFFFF", nationality: "🇬🇧",
    ratings: { pace: 78, consistency: 75, racecraft: 79, qualifying: 76, wet: 72 },
    raceHistory: [6] },
  { id: "LIN", name: "Arvid Lindblad",   team: "Racing Bulls",  pts: 4,  color: "#6692FF", nationality: "🇸🇪",
    ratings: { pace: 76, consistency: 73, racecraft: 74, qualifying: 75, wet: 70 },
    raceHistory: [4] },
  { id: "BOR", name: "Gabriel Bortoleto", team: "Audi",          pts: 2,  color: "#e8091e", nationality: "🇧🇷",
    ratings: { pace: 75, consistency: 72, racecraft: 76, qualifying: 74, wet: 71 },
    raceHistory: [2] },
  { id: "GAS", name: "Pierre Gasly",      team: "Alpine",        pts: 1,  color: "#0090FF", nationality: "🇫🇷",
    ratings: { pace: 80, consistency: 78, racecraft: 81, qualifying: 79, wet: 80 },
    raceHistory: [1] },
];

const constructors = [
  { id: "MER", name: "Mercedes",     pts: 43, color: "#00D2BE", drivers: ["RUS","ANT"] },
  { id: "FER", name: "Ferrari",      pts: 27, color: "#DC143C", drivers: ["LEC","HAM"] },
  { id: "MCL", name: "McLaren",      pts: 10, color: "#FF8000", drivers: ["NOR","PIA"] },
  { id: "RBR", name: "Red Bull",     pts: 8,  color: "#1E41FF", drivers: ["VER","HAD"] },
  { id: "HAS", name: "Haas",         pts: 6,  color: "#FFFFFF", drivers: ["BEA","HUL"] },
  { id: "VCR", name: "Racing Bulls", pts: 4,  color: "#6692FF", drivers: ["LIN","HAD"] },
  { id: "AUD", name: "Audi",         pts: 2,  color: "#e8091e", drivers: ["BOR","ZHO"] },
  { id: "ALP", name: "Alpine",       pts: 1,  color: "#0090FF", drivers: ["GAS","OCO"] },
];

const upcomingRaces = [
  { round: 2,  name: "Chinese GP",    flag: "🇨🇳", circuit: "Shanghai",    favorites: ["RUS","LEC","NOR"] },
  { round: 3,  name: "Japanese GP",   flag: "🇯🇵", circuit: "Suzuka",      favorites: ["VER","RUS","LEC"] },
  { round: 4,  name: "Bahrain GP",    flag: "🇧🇭", circuit: "Sakhir",      favorites: ["RUS","HAM","NOR"] },
  { round: 5,  name: "Saudi Arabian GP", flag: "🇸🇦", circuit: "Jeddah", favorites: ["LEC","RUS","NOR"] },
];

// ─── PREDICTION ENGINE ────────────────────────────────────────────────────────
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
    const isFav = race.favorites.includes(d.id);
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

// ─── THEME ────────────────────────────────────────────────────────────────────
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
    padding: "0.45rem 1rem",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: "0.8rem",
    fontFamily: "'Georgia', serif",
    letterSpacing: "0.05em",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
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

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function F1Tracker() {
  const [tab, setTab] = useState("standings");
  const [drivers, setDrivers] = useState(initialDrivers);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedRace, setSelectedRace] = useState(0);

  useEffect(() => {
  fetch("https://api.jolpi.ca/ergast/f1/2026/driverStandings.json")
    .then(response => response.json())
    .then(data => {
      const standingsData = data.MRData.StandingsTable.StandingsLists[0].DriverStandings;
      const liveDrivers = standingsData.map(entry => ({
        id: entry.Driver.code,
        name: `${entry.Driver.givenName} ${entry.Driver.familyName}`,
        team: entry.Constructors[0].name,
        pts: parseInt(entry.points),
        color: drivers.find(d => d.id === entry.Driver.code)?.color ?? "#888888",
        nationality: drivers.find(d => d.id === entry.Driver.code)?.nationality ?? "🏁",
        ratings: drivers.find(d => d.id === entry.Driver.code)?.ratings ?? 
          { pace: 80, consistency: 80, racecraft: 80, qualifying: 80, wet: 80 },
        raceHistory: [parseInt(entry.points)],
      }));
      setDrivers(liveDrivers);
    });
}, []);
  const predicted = predictChampionship(drivers);
  const racePredictions = predictRaceWinner(upcomingRaces[selectedRace], drivers);

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: bg, minHeight: "100vh", color: text, padding: "1.5rem 1rem" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <span style={{ color: accent, fontSize: "1.4rem" }}>⬡</span>
            <span style={{ fontSize: "0.65rem", letterSpacing: "0.25em", color: muted, textTransform: "uppercase", fontFamily: "monospace" }}>
              F1 STAT TRACKER  ·  2026 SEASON
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

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {[["standings","Standings"],["constructors","Constructors"],["predict","Championship Prediction"],["race","Race Predictor"],["build","How to Build This"]].map(([id,label]) => (
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
                <span style={{ fontSize: "0.9rem" }}>{d.nationality}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{d.name}</div>
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
                <SectionTitle>Driver Profile — {selectedDriver.name}</SectionTitle>
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
                ⚠️ <strong style={{ color: "#fff" }}>Early Season Caution:</strong> Only 1 of 24 races complete. Predictions carry high uncertainty. The model uses current points, car performance factor, driver ratings, and projected consistency over 23 remaining rounds.
              </div>
            </Card>
            <SectionTitle>Projected Final Championship Standings</SectionTitle>
            {predicted.slice(0,8).map((d, i) => (
              <Card key={d.id} style={{ marginBottom: "0.6rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span style={{ color: i < 3 ? [accent,"#C0C0C0","#CD7F32"][i] : muted, fontFamily: "monospace", fontSize: "0.85rem", width: 22 }}>P{i+1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600 }}>{d.name}</span>
                      <span style={{ fontSize: "0.72rem", color: muted }}>({d.team})</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.3rem" }}>
                      <span style={{ fontSize: "0.7rem", color: muted }}>Now: <span style={{ color: "#fff" }}>{d.pts}pts</span></span>
                      <span style={{ fontSize: "0.7rem", color: muted }}>→</span>
                      <span style={{ fontSize: "0.7rem", color: d.color }}>Projected: <strong>{d.projectedPts}pts</strong></span>
                    </div>
                    <div style={{ height: 4, background: "#1a1a24", borderRadius: 99, overflow: "hidden", marginTop: "0.4rem" }}>
                      <div style={{ height: "100%", width: `${Math.min(100,(d.projectedPts/(predicted[0].projectedPts))*100)}%`, background: d.color, borderRadius: 99 }} />
                    </div>
                  </div>
                  <div style={{
                    background: `${d.color}22`, border: `1px solid ${d.color}44`,
                    borderRadius: 8, padding: "0.35rem 0.65rem", textAlign: "center", flexShrink: 0
                  }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: d.color }}>{d.confidence}%</div>
                    <div style={{ fontSize: "0.6rem", color: muted }}>title odds</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── RACE PREDICTOR TAB ── */}
        {tab === "race" && (
          <div>
            <SectionTitle>Select Upcoming Race</SectionTitle>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
              {upcomingRaces.map((r, i) => (
                <button key={i} onClick={() => setSelectedRace(i)} style={{
                  background: selectedRace === i ? "#1e1e2e" : "transparent",
                  border: `1px solid ${selectedRace === i ? accent : border}`,
                  color: selectedRace === i ? "#fff" : muted,
                  padding: "0.5rem 0.85rem", borderRadius: 8, cursor: "pointer", fontSize: "0.82rem",
                }}>
                  {r.flag} R{r.round} {r.name.replace(" GP","")}
                </button>
              ))}
            </div>

            <Card style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                {upcomingRaces[selectedRace].flag} {upcomingRaces[selectedRace].name}
              </div>
              <div style={{ fontSize: "0.78rem", color: muted }}>{upcomingRaces[selectedRace].circuit} Circuit · Round {upcomingRaces[selectedRace].round}</div>
            </Card>

            <SectionTitle>Race Win Probability</SectionTitle>
            {racePredictions.slice(0,6).map((d, i) => (
              <Card key={d.id} style={{ marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <span style={{ color: i < 3 ? [accent,"#C0C0C0","#CD7F32"][i] : muted, fontFamily: "monospace", fontSize: "0.8rem", width: 22 }}>P{i+1}</span>
                  <span style={{ fontSize: "0.85rem" }}>{d.nationality}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{d.name}</div>
                    <div style={{ height: 5, background: "#1a1a24", borderRadius: 99, overflow: "hidden", marginTop: "0.3rem" }}>
                      <div style={{ height: "100%", width: `${d.winPct * 2.5}%`, background: d.color, borderRadius: 99 }} />
                    </div>
                  </div>
                  <div style={{ color: d.color, fontWeight: 700, fontSize: "1rem", width: 42, textAlign: "right" }}>
                    {d.winPct}%
                  </div>
                </div>
              </Card>
            ))}
            <div style={{ fontSize: "0.72rem", color: muted, marginTop: "0.75rem" }}>
              * Probabilities based on driver ratings, car performance, circuit history affinity, and remaining probability mass. Updates as season data grows.
            </div>
          </div>
        )}

        {/* ── HOW TO BUILD THIS TAB ── */}
        {tab === "build" && (
          <div>
            <SectionTitle>Your F1 App — The Tech Stack</SectionTitle>

            {[
              {
                phase: "Phase 1",
                title: "Get the Data",
                color: "#FF6B35",
                desc: "Your app lives or dies by its data. Use the Ergast API (free, updated after every GP) or the official F1 API.",
                items: [
                  "Ergast F1 API — ergast.com/mrd/ — free, 70+ years of data",
                  "FastF1 (Python library) — telemetry, lap times, tire data",
                  "OpenF1 API — live timing & positional data",
                  "Learn: REST APIs, fetch(), JSON parsing",
                ],
              },
              {
                phase: "Phase 2",
                title: "Build the Frontend",
                color: "#F7B731",
                desc: "React is perfect for dynamic dashboards. Add Recharts or D3 for visualizations.",
                items: [
                  "React (component-based UI — what you're looking at now!)",
                  "Recharts or D3.js for charts and graphs",
                  "CSS / Tailwind for styling",
                  "Learn: React state, useEffect for data fetching",
                ],
              },
              {
                phase: "Phase 3",
                title: "Build the Prediction Model",
                color: "#26C6DA",
                desc: "Start simple — linear regression on points. Level up to machine learning.",
                items: [
                  "Python + Pandas for data wrangling",
                  "Scikit-learn for regression/classification models",
                  "Features: current pts, car pace, circuit history, weather",
                  "Eventually: train on historical F1 data (2010–2025)",
                ],
              },
              {
                phase: "Phase 4",
                title: "Connect it All",
                color: "#AB47BC",
                desc: "Build a backend that fetches new data after each GP and serves it to your frontend.",
                items: [
                  "Node.js + Express OR Python Flask/FastAPI as your backend",
                  "A database (PostgreSQL or MongoDB) to store race history",
                  "Scheduled jobs (cron) to pull fresh data after each race",
                  "Deploy to Vercel (frontend) + Railway (backend)",
                ],
              },
            ].map(p => (
              <Card key={p.phase} style={{ marginBottom: "0.75rem", borderLeft: `3px solid ${p.color}` }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
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
                </div>
              </Card>
            ))}

            <Card style={{ borderColor: accent+"44", background: "#130a0a", marginTop: "0.5rem" }}>
              <div style={{ fontSize: "0.78rem", color: "#f0a0a0", lineHeight: 1.7 }}>
                🏎️ <strong style={{ color: "#fff" }}>Pro tip:</strong> What you see here is a <em>prototype</em> built to show you the vision. Start by replicating just the standings tab using real Ergast API data. That one small win will teach you API calls, state management, and rendering — everything you need for the rest.
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}