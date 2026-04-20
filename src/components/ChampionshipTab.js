import { SectionLabel, DriverAvatar, ProgressBar, PosColor, Badge } from "./ui";
import { theme, COMPLETED_ROUNDS, TOTAL_ROUNDS, predictChampionship } from "../constants";

const { accent, muted, border } = theme;

export default function ChampionshipTab({ drivers, mlPredictions }) {
  const localPredictions = predictChampionship(drivers);
  const useMl = mlPredictions.length > 0;
  const predictions = useMl ? mlPredictions : localPredictions;
  const topPts = predictions[0]?.predicted_points || predictions[0]?.projectedPts || 1;

  return (
    <div className="fade-in">
      {/* Header cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{
          background: "#0a1628", border: "1px solid #1E41FF44",
          borderRadius: 10, padding: "1rem 1.25rem",
        }}>
          <div style={{ fontSize: "0.6rem", color: "#4488ff", letterSpacing: "0.18em", fontFamily: "monospace", marginBottom: "0.4rem" }}>
            {useMl ? "ML MODEL ACTIVE — XGBOOST" : "LOCAL MODEL"}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#aaa" }}>
            {useMl
              ? "XGBoost trained on 2893 samples · 23.27 MAE"
              : "Pace-weighted formula · early season estimate"}
          </div>
        </div>
        <div style={{
          background: "#130a0a", border: `1px solid ${accent}33`,
          borderRadius: 10, padding: "1rem 1.25rem",
        }}>
          <div style={{ fontSize: "0.6rem", color: "#f0a0a0", letterSpacing: "0.18em", fontFamily: "monospace", marginBottom: "0.4rem" }}>
            CAUTION — EARLY SEASON
          </div>
          <div style={{ fontSize: "0.82rem", color: "#f0a0a0" }}>
            Round {COMPLETED_ROUNDS}/{TOTAL_ROUNDS} complete — high uncertainty
          </div>
        </div>
      </div>

      <SectionLabel>Projected Final Championship Standings</SectionLabel>

      {predictions.slice(0, 10).map((d, i) => {
        const driverName = d.name || d.driver || "Unknown";
        const driverColor = d.color || accent;
        const projPts = d.predicted_points || d.projectedPts || 0;
        const currentPts = d.pts || d.current_points || 0;
        const confidence = d.confidence || d.win_probability || 0;
        const gain = projPts - currentPts;

        return (
          <div key={i} style={{
            background: "#12121a",
            border: `1px solid ${i === 0 ? driverColor + "44" : border}`,
            borderLeft: `3px solid ${driverColor}`,
            borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "0.6rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{
                color: PosColor(i), fontFamily: "monospace",
                fontSize: "0.85rem", width: 24, flexShrink: 0, fontWeight: 700,
              }}>{i + 1}</span>

              <DriverAvatar driverId={d.driver || d.id} name={driverName} size={44} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{driverName}</span>
                  <span style={{ fontSize: "0.72rem", color: muted }}>{d.team}</span>
                  {i === 0 && <Badge color={accent}>Champion Favourite</Badge>}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.75rem", color: muted }}>
                    Now: <span style={{ color: "#ccc", fontWeight: 600 }}>{currentPts} pts</span>
                  </span>
                  <span style={{ fontSize: "0.75rem", color: muted }}>→</span>
                  <span style={{ fontSize: "0.75rem", color: driverColor, fontWeight: 600 }}>
                    Projected: {projPts} pts
                  </span>
                  {gain > 0 && (
                    <span style={{ fontSize: "0.68rem", color: "#00e472", fontFamily: "monospace" }}>
                      +{gain} remaining
                    </span>
                  )}
                </div>

                {/* Confidence bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: "0.6rem", color: muted, fontFamily: "monospace", letterSpacing: "0.1em" }}>
                      PROJECTED POINTS
                    </span>
                    <span style={{ fontSize: "0.6rem", color: driverColor, fontFamily: "monospace" }}>
                      {((projPts / topPts) * 100).toFixed(0)}% of leader
                    </span>
                  </div>
                  <ProgressBar value={projPts} max={topPts} color={driverColor} height={6} />
                </div>
              </div>

              {/* Confidence badge */}
              <div style={{
                background: `${driverColor}18`, border: `1px solid ${driverColor}44`,
                borderRadius: 10, padding: "0.6rem 0.9rem",
                textAlign: "center", flexShrink: 0, minWidth: 64,
              }}>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: driverColor, lineHeight: 1 }}>
                  {confidence}%
                </div>
                <div style={{ fontSize: "0.58rem", color: muted, fontFamily: "monospace", marginTop: "0.2rem" }}>
                  TITLE ODDS
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: "0.7rem", color: muted, marginTop: "0.75rem", lineHeight: 1.6 }}>
        * {useMl
          ? "Predictions from XGBoost ML model trained on 2010–2025 historical data with FastF1 pace ratings."
          : "Predictions based on pace ratings, car performance factor, and current points trajectory."}
      </div>
    </div>
  );
}
