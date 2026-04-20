import { Card, SectionLabel, DriverAvatar, ProgressBar, PosColor, LoadingSpinner } from "./ui";
import { theme, COUNTRY_FLAGS, predictRaceWinner } from "../constants";

const { accent, muted, border } = theme;

export default function RacePredictorTab({
  schedule, selectedRace, setSelectedRace,
  drivers, raceMlPredictions, loadingRace,
  liveData, liveRound, setLiveRound, liveLoading,
}) {
  const currentRace = schedule[selectedRace];
  const localPredictions = predictRaceWinner(currentRace || {}, drivers);
  const predictions = raceMlPredictions.length > 0 ? raceMlPredictions : localPredictions;

  return (
    <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>

      {/* ── Left: Race Predictor ── */}
      <div>
        <SectionLabel>Race Win Probability — Select Round</SectionLabel>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: "0.5rem", marginBottom: "1.5rem",
        }}>
          {schedule.map((r, i) => {
            const active = selectedRace === i;
            const flag = COUNTRY_FLAGS[r.country] || "🏁";
            return (
              <button key={i} onClick={() => setSelectedRace(i)} style={{
                background: active ? "#1a1020" : "#12121a",
                border: `1px solid ${active ? accent + "88" : border}`,
                color: active ? "#fff" : "#666",
                padding: "0.6rem 0.5rem", borderRadius: 8, cursor: "pointer",
                fontSize: "0.75rem", textAlign: "left", transition: "all 0.15s",
                fontFamily: "inherit",
              }}>
                <div style={{ fontSize: "1.1rem", marginBottom: "0.15rem" }}>{flag}</div>
                <div style={{ fontWeight: active ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.name?.replace(" Grand Prix", "") || r.country}
                </div>
                <div style={{ fontSize: "0.62rem", color: active ? muted : "#333", fontFamily: "monospace" }}>
                  R{r.round}
                </div>
              </button>
            );
          })}
        </div>

        {currentRace && (
          <div style={{
            background: "#0f0a0a", border: `1px solid ${accent}33`,
            borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.25rem",
            display: "flex", alignItems: "center", gap: "1rem",
          }}>
            <span style={{ fontSize: "2.2rem" }}>{COUNTRY_FLAGS[currentRace.country] || "🏁"}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{currentRace.name}</div>
              <div style={{ fontSize: "0.78rem", color: muted }}>
                Round {currentRace.round} · {currentRace.circuit}
              </div>
              {raceMlPredictions.length > 0 && (
                <div style={{ fontSize: "0.62rem", color: "#4488ff", fontFamily: "monospace", marginTop: "0.2rem" }}>
                  ML MODEL — XGBOOST
                </div>
              )}
            </div>
          </div>
        )}

        <SectionLabel>Win Probability</SectionLabel>

        {loadingRace && <LoadingSpinner label="Fetching predictions..." />}

        {!loadingRace && predictions.slice(0, 8).map((d, i) => {
          const driverName = d.name || d.driver || "Unknown";
          const driverColor = d.color || accent;
          const winProb = d.winPct || d.win_probability || 0;

          return (
            <div key={i} style={{
              background: "#12121a",
              border: `1px solid ${i === 0 ? driverColor + "44" : border}`,
              borderLeft: `3px solid ${driverColor}`,
              borderRadius: 8, padding: "0.85rem 1rem", marginBottom: "0.4rem",
              display: "flex", alignItems: "center", gap: "0.85rem",
            }}>
              <span style={{ color: PosColor(i), fontFamily: "monospace", fontSize: "0.82rem", width: 22, flexShrink: 0, fontWeight: 700 }}>
                {i + 1}
              </span>
              <DriverAvatar driverId={d.driver || d.id} name={driverName} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.15rem" }}>
                  <span style={{ fontSize: "0.85rem" }}>{d.nationality || ""}</span>
                  <span style={{ fontWeight: 600 }}>{driverName}</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: muted, marginBottom: "0.3rem" }}>{d.team}</div>
                {d.circuit_avg_finish && (
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                    {d.qualifying_position && (
                      <span style={{ fontSize: "0.64rem", background: "#1a1a2e", borderRadius: 4, padding: "0.1rem 0.35rem", color: "#aaa" }}>
                        P{d.qualifying_position} quali
                      </span>
                    )}
                    <span style={{ fontSize: "0.64rem", background: "#1a1a2e", borderRadius: 4, padding: "0.1rem 0.35rem", color: "#aaa" }}>
                      avg P{d.circuit_avg_finish} here
                    </span>
                    {d.circuit_podium_rate !== undefined && (
                      <span style={{ fontSize: "0.64rem", background: "#1a1a2e", borderRadius: 4, padding: "0.1rem 0.35rem", color: "#aaa" }}>
                        {d.circuit_podium_rate}% podium
                      </span>
                    )}
                  </div>
                )}
                <ProgressBar value={winProb} max={Math.max(...predictions.slice(0,8).map(p => p.winPct || p.win_probability || 0), 1)} color={driverColor} height={4} />
              </div>
              <div style={{
                background: `${driverColor}18`, border: `1px solid ${driverColor}44`,
                borderRadius: 8, padding: "0.4rem 0.65rem", textAlign: "center", flexShrink: 0, minWidth: 52,
              }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: driverColor }}>{winProb}%</div>
                <div style={{ fontSize: "0.58rem", color: muted }}>win</div>
              </div>
            </div>
          );
        })}

        <div style={{ fontSize: "0.68rem", color: muted, marginTop: "0.75rem" }}>
          * Probabilities from ML model, qualifying position, circuit history and car pace.
        </div>
      </div>

      {/* ── Right: Live Race ── */}
      <div>
        <SectionLabel>Live Race Prediction</SectionLabel>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", color: muted }}>Round:</span>
          {Array.from({ length: 6 }, (_, i) => i + 1).map(r => (
            <button key={r} onClick={() => setLiveRound(r)} style={{
              background: liveRound === r ? accent : "transparent",
              border: `1px solid ${liveRound === r ? accent : border}`,
              color: liveRound === r ? "#fff" : muted,
              padding: "0.3rem 0.65rem", borderRadius: 6, cursor: "pointer",
              fontSize: "0.78rem", fontFamily: "inherit", transition: "all 0.15s",
            }}>R{r}</button>
          ))}
        </div>

        {liveLoading && !liveData && <LoadingSpinner label="Loading live data..." />}

        {liveData && (
          <>
            <Card style={{
              marginBottom: "1rem",
              borderColor: liveData.state === "live" ? "#00ff8844" : liveData.state === "finished" ? "#C0C0C044" : border,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {liveData.state === "live" && (
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%", background: "#00ff88",
                      animation: "pulse 1.5s infinite",
                    }} />
                  )}
                  <span style={{
                    fontWeight: 700, fontSize: "0.9rem",
                    color: liveData.state === "live" ? "#00ff88" : liveData.state === "finished" ? "#C0C0C0" : "#ccc",
                  }}>
                    {liveData.state === "live" ? "LIVE" : liveData.state === "finished" ? "FINISHED" : "PRE-RACE"}
                  </span>
                  {liveData.race_control && liveData.race_control !== "NONE" && (
                    <span style={{ fontSize: "0.72rem", background: "#ff8c0022", border: "1px solid #ff8c0044", borderRadius: 4, padding: "0.2rem 0.5rem", color: "#ff8c00" }}>
                      {liveData.race_control.replace("_", " ")}
                    </span>
                  )}
                </div>
                {liveData.state === "live" && (
                  <div style={{ fontSize: "0.78rem", color: muted }}>
                    Lap <span style={{ color: "#ccc" }}>{liveData.laps_done}</span>/{liveData.total_laps}
                    <span style={{ marginLeft: "0.75rem", color: accent }}>{liveData.race_progress}%</span>
                  </div>
                )}
              </div>
              {liveData.state === "live" && (
                <div style={{ marginTop: "0.75rem", height: 4, background: "#1a1a24", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${liveData.race_progress}%`, background: "#00ff88", borderRadius: 99, transition: "width 1s ease" }} />
                </div>
              )}
            </Card>

            {(liveData.predictions || []).slice(0, 10).map((d, i) => {
              const driverColor = d.color || accent;
              const compound = d.tyre_compound;
              const compColor = { SOFT: "#e10600", MEDIUM: "#f5c518", HARD: "#f0f0f0", INTER: "#00a86b", WET: "#4488ff" }[compound] || muted;
              const isRaceLive = liveData.state === "live";

              return (
                <div key={d.driver || i} style={{
                  background: "#12121a",
                  border: `1px solid ${i === 0 ? driverColor + "44" : border}`,
                  borderLeft: `3px solid ${driverColor}`,
                  borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "0.4rem",
                  display: "flex", alignItems: "center", gap: "0.85rem",
                }}>
                  <span style={{ color: PosColor(i), fontFamily: "monospace", fontSize: "0.82rem", width: 22, flexShrink: 0, fontWeight: 700 }}>
                    P{isRaceLive ? d.position : i + 1}
                  </span>
                  <DriverAvatar driverId={d.driver} name={d.name || d.driver} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.15rem" }}>
                      {d.name || d.driver}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: muted, marginBottom: "0.3rem" }}>{d.team}</div>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                      {isRaceLive && d.gap_to_leader !== undefined && (
                        <span style={{ fontSize: "0.64rem", background: "#1a1a2e", borderRadius: 4, padding: "0.1rem 0.35rem", color: "#aaa" }}>
                          {d.gap_to_leader === 0 ? "LEADER" : `+${typeof d.gap_to_leader === "number" ? d.gap_to_leader.toFixed(1) : d.gap_to_leader}s`}
                        </span>
                      )}
                      {isRaceLive && compound && (
                        <span style={{ fontSize: "0.64rem", background: `${compColor}22`, border: `1px solid ${compColor}44`, borderRadius: 4, padding: "0.1rem 0.35rem", color: compColor }}>
                          {compound} ({d.tyre_age}L)
                        </span>
                      )}
                      {!isRaceLive && d.qualifying_position && (
                        <span style={{ fontSize: "0.64rem", background: "#1a1a2e", borderRadius: 4, padding: "0.1rem 0.35rem", color: "#aaa" }}>
                          P{d.qualifying_position} quali
                        </span>
                      )}
                    </div>
                    <ProgressBar
                      value={d.win_probability || 0}
                      max={Math.max(...(liveData.predictions || []).map(p => p.win_probability || 0), 1)}
                      color={driverColor} height={3}
                    />
                  </div>
                  <div style={{ background: `${driverColor}18`, border: `1px solid ${driverColor}44`, borderRadius: 8, padding: "0.4rem 0.6rem", textAlign: "center", flexShrink: 0, minWidth: 48 }}>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: driverColor }}>{d.win_probability || 0}%</div>
                    <div style={{ fontSize: "0.58rem", color: muted }}>win</div>
                  </div>
                </div>
              );
            })}

            <div style={{ fontSize: "0.68rem", color: muted, marginTop: "0.75rem" }}>
              {liveData.state === "live"
                ? "* Live probabilities blend ML model with current position, gap and tyre. Updates every 15s."
                : "* Pre-race ML prediction. Will update live once race starts."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
