import { motion } from "framer-motion";
import { GlassCard, SectionLabel, DriverAvatar, ProgressBar, PosColor, LoadingSpinner, SkeletonRow, listVariants, rowVariants } from "./ui";
import { theme, COUNTRY_FLAGS, predictRaceWinner } from "../constants";

const { accent } = theme;

export default function RacePredictorTab({
  schedule, selectedRace, setSelectedRace,
  drivers, raceMlPredictions, loadingRace,
  liveData, liveRound, setLiveRound, liveLoading,
}) {
  const currentRace = schedule[selectedRace];
  const localPreds  = predictRaceWinner(currentRace || {}, drivers);
  const predictions = raceMlPredictions.length > 0 ? raceMlPredictions : localPreds;
  const maxProb = Math.max(...predictions.slice(0,8).map(d => d.winPct || d.win_probability || 0), 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>

      {/* ── Race Predictor ── */}
      <div>
        <SectionLabel>Race Win Probability — Select Round</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: "0.4rem", marginBottom: "1.5rem" }}>
          {schedule.map((r, i) => {
            const active = selectedRace === i;
            const flag   = COUNTRY_FLAGS[r.country] || "🏁";
            return (
              <motion.button key={i} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedRace(i)} style={{
                  background: active ? "rgba(225,6,0,0.14)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? accent + "66" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#fff" : "#555",
                  padding: "0.6rem 0.5rem", borderRadius: 8, cursor: "pointer",
                  fontSize: "0.73rem", textAlign: "left", fontFamily: "inherit",
                }}>
                <div style={{ fontSize: "1.05rem", marginBottom: "0.15rem" }}>{flag}</div>
                <div style={{ fontWeight: active ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name?.replace(" Grand Prix", "") || r.country}
                </div>
                <div style={{ fontSize: "0.6rem", color: active ? "#666" : "#2a2a3a", fontFamily: "monospace" }}>R{r.round}</div>
              </motion.button>
            );
          })}
        </div>

        {currentRace && (
          <div style={{ background: "rgba(18,8,8,0.9)", border: `1px solid ${accent}22`, borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1.25rem", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "2rem" }}>{COUNTRY_FLAGS[currentRace.country] || "🏁"}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{currentRace.name}</div>
              <div style={{ fontSize: "0.75rem", color: "#555" }}>Round {currentRace.round} · {currentRace.circuit}</div>
              {raceMlPredictions.length > 0 && (
                <div style={{ fontSize: "0.58rem", color: "#4488ff", fontFamily: "monospace", letterSpacing: "0.12em", marginTop: "0.2rem" }}>XGBOOST MODEL</div>
              )}
            </div>
          </div>
        )}

        <SectionLabel>Win Probability</SectionLabel>
        {loadingRace ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} lines={2} />)
        ) : (
          <motion.div variants={listVariants} initial="hidden" animate="show">
            {predictions.slice(0, 8).map((d, i) => {
              const dName  = d.name || d.driver || "Unknown";
              const dColor = d.color || accent;
              const prob   = d.winPct || d.win_probability || 0;
              return (
                <motion.div key={i} variants={rowVariants} whileHover={{ x: 2 }}
                  style={{
                    background: "rgba(10,10,18,0.85)",
                    backdropFilter: "blur(12px)",
                    border: `1px solid ${i === 0 ? dColor + "33" : "rgba(255,255,255,0.05)"}`,
                    borderLeft: `3px solid ${dColor}`,
                    borderRadius: 9, padding: "0.8rem 1rem", marginBottom: "0.4rem",
                    display: "flex", alignItems: "center", gap: "0.85rem",
                  }}>
                  <span style={{ color: PosColor(i), fontFamily: "monospace", fontSize: "0.78rem", width: 20, flexShrink: 0, fontWeight: 700 }}>{i+1}</span>
                  <DriverAvatar driverId={d.driver || d.id} name={dName} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", marginBottom: "0.15rem" }}>
                      <span style={{ fontSize: "0.82rem" }}>{d.nationality || ""}</span>
                      <span style={{ fontWeight: 600 }}>{dName}</span>
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "#444", marginBottom: "0.3rem" }}>{d.team}</div>
                    {d.circuit_avg_finish && (
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                        {d.qualifying_position && <span style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "0.1rem 0.35rem", color: "#666" }}>P{d.qualifying_position} quali</span>}
                        <span style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "0.1rem 0.35rem", color: "#666" }}>avg P{d.circuit_avg_finish}</span>
                        {d.circuit_podium_rate !== undefined && <span style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "0.1rem 0.35rem", color: "#666" }}>{d.circuit_podium_rate}% podium</span>}
                      </div>
                    )}
                    <ProgressBar value={prob} max={maxProb} color={dColor} height={4} animated />
                  </div>
                  <div style={{ background: `${dColor}14`, border: `1px solid ${dColor}33`, borderRadius: 8, padding: "0.4rem 0.65rem", textAlign: "center", flexShrink: 0, minWidth: 50 }}>
                    <div style={{ fontSize: "1.05rem", fontWeight: 800, color: dColor, fontVariantNumeric: "tabular-nums" }}>{prob}%</div>
                    <div style={{ fontSize: "0.55rem", color: "#444" }}>win</div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
        <div style={{ fontSize: "0.66rem", color: "#333", marginTop: "0.75rem" }}>* ML model · qualifying position · circuit history · car pace.</div>
      </div>

      {/* ── Live Race ── */}
      <div>
        <SectionLabel>Live Race Prediction</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.72rem", color: "#444" }}>Round:</span>
          {Array.from({ length: 6 }, (_, i) => i + 1).map(r => (
            <motion.button key={r} whileTap={{ scale: 0.94 }} onClick={() => setLiveRound(r)} style={{
              background: liveRound === r ? "rgba(225,6,0,0.16)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${liveRound === r ? accent + "66" : "rgba(255,255,255,0.06)"}`,
              color: liveRound === r ? "#fff" : "#555",
              padding: "0.3rem 0.6rem", borderRadius: 6, cursor: "pointer",
              fontSize: "0.75rem", fontFamily: "inherit",
            }}>R{r}</motion.button>
          ))}
        </div>

        {liveLoading && !liveData && <LoadingSpinner label="Loading live data..." />}

        {liveData && (
          <>
            <GlassCard style={{ marginBottom: "1rem", borderColor: liveData.state === "live" ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {liveData.state === "live" && (
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#00ff88", animation: "pulse 1.5s infinite" }} />
                  )}
                  <span style={{ fontWeight: 700, fontSize: "0.88rem", color: liveData.state === "live" ? "#00ff88" : liveData.state === "finished" ? "#C0C0C0" : "#aaa" }}>
                    {liveData.state === "live" ? "LIVE" : liveData.state === "finished" ? "FINISHED" : "PRE-RACE"}
                  </span>
                  {liveData.race_control && liveData.race_control !== "NONE" && (
                    <span style={{ fontSize: "0.68rem", background: "#ff8c0018", border: "1px solid #ff8c0033", borderRadius: 4, padding: "0.15rem 0.45rem", color: "#ff8c00" }}>
                      {liveData.race_control.replace("_"," ")}
                    </span>
                  )}
                </div>
                {liveData.state === "live" && (
                  <div style={{ fontSize: "0.75rem", color: "#555" }}>
                    Lap <span style={{ color: "#aaa" }}>{liveData.laps_done}</span>/{liveData.total_laps}
                    <span style={{ marginLeft: "0.6rem", color: accent }}>{liveData.race_progress}%</span>
                  </div>
                )}
              </div>
              {liveData.state === "live" && (
                <div style={{ marginTop: "0.75rem", height: 3, background: "rgba(255,255,255,0.04)", borderRadius: 99, overflow: "hidden" }}>
                  <motion.div animate={{ width: `${liveData.race_progress}%` }} transition={{ duration: 0.8 }}
                    style={{ height: "100%", background: "#00ff88", borderRadius: 99 }} />
                </div>
              )}
            </GlassCard>

            <motion.div variants={listVariants} initial="hidden" animate="show">
              {(liveData.predictions || []).slice(0, 10).map((d, i) => {
                const dColor  = d.color || accent;
                const compound = d.tyre_compound;
                const cColor  = { SOFT:"#e10600", MEDIUM:"#f5c518", HARD:"#f0f0f0", INTER:"#00a86b", WET:"#4488ff" }[compound] || "#555";
                const isRaceLive = liveData.state === "live";
                return (
                  <motion.div key={d.driver || i} variants={rowVariants} whileHover={{ x: 2 }}
                    style={{
                      background: "rgba(10,10,18,0.85)", backdropFilter: "blur(12px)",
                      border: `1px solid ${i === 0 ? dColor + "33" : "rgba(255,255,255,0.05)"}`,
                      borderLeft: `3px solid ${dColor}`,
                      borderRadius: 9, padding: "0.75rem 1rem", marginBottom: "0.4rem",
                      display: "flex", alignItems: "center", gap: "0.85rem",
                    }}>
                    <span style={{ color: PosColor(i), fontFamily: "monospace", fontSize: "0.8rem", width: 22, flexShrink: 0, fontWeight: 700 }}>
                      P{isRaceLive ? d.position : i + 1}
                    </span>
                    <DriverAvatar driverId={d.driver} name={d.name || d.driver} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.86rem", marginBottom: "0.15rem" }}>{d.name || d.driver}</div>
                      <div style={{ fontSize: "0.68rem", color: "#444", marginBottom: "0.3rem" }}>{d.team}</div>
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                        {isRaceLive && d.gap_to_leader !== undefined && (
                          <span style={{ fontSize: "0.62rem", background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "0.1rem 0.3rem", color: "#666" }}>
                            {d.gap_to_leader === 0 ? "LEADER" : `+${typeof d.gap_to_leader === "number" ? d.gap_to_leader.toFixed(1) : d.gap_to_leader}s`}
                          </span>
                        )}
                        {isRaceLive && compound && (
                          <span style={{ fontSize: "0.62rem", background: `${cColor}18`, border: `1px solid ${cColor}33`, borderRadius: 4, padding: "0.1rem 0.3rem", color: cColor }}>
                            {compound} ({d.tyre_age}L)
                          </span>
                        )}
                      </div>
                      <ProgressBar value={d.win_probability || 0}
                        max={Math.max(...(liveData.predictions||[]).map(p => p.win_probability||0), 1)}
                        color={dColor} height={3} animated />
                    </div>
                    <div style={{ background: `${dColor}14`, border: `1px solid ${dColor}30`, borderRadius: 8, padding: "0.4rem 0.6rem", textAlign: "center", flexShrink: 0, minWidth: 48 }}>
                      <div style={{ fontSize: "1rem", fontWeight: 800, color: dColor, fontVariantNumeric: "tabular-nums" }}>{d.win_probability||0}%</div>
                      <div style={{ fontSize: "0.55rem", color: "#444" }}>win</div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            <div style={{ fontSize: "0.66rem", color: "#333", marginTop: "0.75rem" }}>
              {liveData.state === "live"
                ? "* Live probabilities blend ML model with position, gap and tyre. Updates every 15s."
                : "* Pre-race ML prediction. Updates live once race starts."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
