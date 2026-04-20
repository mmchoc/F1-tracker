import { motion } from "framer-motion";
import { SectionLabel, DriverAvatar, ProgressBar, PosColor, Badge, AnimatedCounter, Skeleton, listVariants, rowVariants } from "./ui";
import { theme, COMPLETED_ROUNDS, TOTAL_ROUNDS, predictChampionship } from "../constants";

const { accent } = theme;

export default function ChampionshipTab({ drivers, mlPredictions }) {
  const localPreds = predictChampionship(drivers);
  const useMl = mlPredictions.length > 0;
  const predictions = useMl ? mlPredictions : localPreds;
  const topPts = predictions[0]?.predicted_points || predictions[0]?.projectedPts || 1;
  const loading = !predictions.length;

  return (
    <div>
      {/* Info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.75rem" }}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ background: "rgba(8,12,28,0.85)", border: "1px solid rgba(30,65,255,0.2)", borderRadius: 12, padding: "1.1rem 1.25rem", backdropFilter: "blur(16px)" }}>
          <div style={{ fontSize: "0.58rem", color: "#4488ff", letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: "0.4rem" }}>
            {useMl ? "XGBOOST MODEL ACTIVE" : "LOCAL MODEL"}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#888", lineHeight: 1.5 }}>
            {useMl
              ? "Trained on 2893 samples · 23.27 MAE · FastF1 pace ratings"
              : "Pace-weighted formula — load Railway API for ML predictions"}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ background: "rgba(20,8,8,0.85)", border: `1px solid rgba(225,6,0,0.18)`, borderRadius: 12, padding: "1.1rem 1.25rem", backdropFilter: "blur(16px)" }}>
          <div style={{ fontSize: "0.58rem", color: "#f08080", letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: "0.4rem" }}>
            EARLY SEASON — HIGH UNCERTAINTY
          </div>
          <div style={{ fontSize: "0.82rem", color: "#888" }}>
            Round {COMPLETED_ROUNDS} of {TOTAL_ROUNDS} complete · {TOTAL_ROUNDS - COMPLETED_ROUNDS} races remaining
          </div>
        </motion.div>
      </div>

      <SectionLabel>Projected Final Championship Standings</SectionLabel>

      {loading ? (
        Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ background: "rgba(12,12,20,0.85)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <Skeleton width={22} height={14} />
              <Skeleton width={44} height={44} borderRadius="50%" />
              <div style={{ flex: 1 }}>
                <Skeleton width="35%" height={13} style={{ marginBottom: 8 }} />
                <Skeleton width="55%" height={6} />
              </div>
              <Skeleton width={56} height={48} borderRadius={10} />
            </div>
          </div>
        ))
      ) : (
        <motion.div variants={listVariants} initial="hidden" animate="show">
          {predictions.slice(0, 10).map((d, i) => {
            const dName  = d.name || d.driver || "Unknown";
            const dColor = d.color || accent;
            const projPts = d.predicted_points || d.projectedPts || 0;
            const curPts  = d.pts || d.current_points || 0;
            const conf    = d.confidence || d.win_probability || 0;
            const gain    = projPts - curPts;

            return (
              <motion.div
                key={i}
                variants={rowVariants}
                whileHover={{ x: 2, borderColor: dColor + "44" }}
                style={{
                  background: i === 0 ? `rgba(12,12,22,0.95)` : "rgba(10,10,18,0.85)",
                  backdropFilter: "blur(16px)",
                  border: `1px solid ${i === 0 ? dColor + "30" : "rgba(255,255,255,0.05)"}`,
                  borderLeft: `3px solid ${dColor}`,
                  borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "0.5rem",
                  boxShadow: i === 0 ? `0 4px 24px ${dColor}10` : "none",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span style={{ color: PosColor(i), fontFamily: "monospace", fontSize: "0.85rem", width: 22, flexShrink: 0, fontWeight: 700 }}>{i + 1}</span>
                  <DriverAvatar driverId={d.driver || d.id} name={dName} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{dName}</span>
                      <span style={{ fontSize: "0.7rem", color: "#444" }}>{d.team}</span>
                      {i === 0 && <Badge color={accent}>Title Favourite</Badge>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.45rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.73rem", color: "#444" }}>
                        Now: <span style={{ color: "#888", fontWeight: 600 }}>{curPts}</span>
                      </span>
                      <span style={{ fontSize: "0.65rem", color: "#333" }}>→</span>
                      <span style={{ fontSize: "0.73rem", color: dColor, fontWeight: 700 }}>
                        Projected: <AnimatedCounter value={projPts} style={{ fontVariantNumeric: "tabular-nums" }} />
                      </span>
                      {gain > 0 && (
                        <span style={{ fontSize: "0.65rem", color: "#00e472", fontFamily: "monospace" }}>+{gain} to earn</span>
                      )}
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: "0.58rem", color: "#333", fontFamily: "monospace", letterSpacing: "0.1em" }}>PROJECTED POINTS</span>
                        <span style={{ fontSize: "0.58rem", color: dColor, fontFamily: "monospace" }}>{Math.round((projPts / topPts) * 100)}% of leader</span>
                      </div>
                      <ProgressBar value={projPts} max={topPts} color={dColor} height={5} animated />
                    </div>
                  </div>
                  <div style={{
                    background: `${dColor}14`, border: `1px solid ${dColor}33`,
                    borderRadius: 10, padding: "0.65rem 0.9rem",
                    textAlign: "center", flexShrink: 0, minWidth: 62,
                  }}>
                    <div style={{ fontSize: "1.35rem", fontWeight: 900, color: dColor, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{conf}%</div>
                    <div style={{ fontSize: "0.56rem", color: "#444", fontFamily: "monospace", letterSpacing: "0.1em", marginTop: "0.2rem" }}>TITLE</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <div style={{ fontSize: "0.68rem", color: "#333", marginTop: "1rem", lineHeight: 1.6 }}>
        * {useMl
          ? "XGBoost model trained on 2010–2025 historical data with FastF1 pace ratings and team performance metrics."
          : "Predictions based on current pace ratings, car performance factor, and points trajectory."}
      </div>
    </div>
  );
}
