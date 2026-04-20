export const TOTAL_ROUNDS = 24;
export const COMPLETED_ROUNDS = 1;
export const REMAINING_ROUNDS = TOTAL_ROUNDS - COMPLETED_ROUNDS;
export const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
export const ERGAST = "https://api.jolpi.ca/ergast/f1";
export const OF1 = "https://api.openf1.org/v1";

export const theme = {
  bg: "#0a0a0f",
  card: "#12121a",
  cardHover: "#16161f",
  border: "#1f1f2e",
  accent: "#e10600",
  accentDim: "#e1060020",
  text: "#f0ece3",
  muted: "#666",
  mutedLight: "#999",
};

export const DRIVER_IMAGES = {
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

export const COUNTRY_FLAGS = {
  Australia: "🇦🇺", China: "🇨🇳", Japan: "🇯🇵", Bahrain: "🇧🇭",
  "Saudi Arabia": "🇸🇦", USA: "🇺🇸", "United States": "🇺🇸",
  Canada: "🇨🇦", Monaco: "🇲🇨", Spain: "🇪🇸", Austria: "🇦🇹",
  UK: "🇬🇧", "United Kingdom": "🇬🇧", Belgium: "🇧🇪", Hungary: "🇭🇺",
  Netherlands: "🇳🇱", Italy: "🇮🇹", Azerbaijan: "🇦🇿", Singapore: "🇸🇬",
  Mexico: "🇲🇽", Brazil: "🇧🇷", Qatar: "🇶🇦", UAE: "🇦🇪", "United Arab Emirates": "🇦🇪",
};

export const initialDrivers = [
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

export const initialConstructors = [
  { id: "MER", name: "Mercedes",     pts: 43, color: "#00D2BE", drivers: ["RUS","ANT"] },
  { id: "FER", name: "Ferrari",      pts: 27, color: "#DC143C", drivers: ["LEC","HAM"] },
  { id: "MCL", name: "McLaren",      pts: 10, color: "#FF8000", drivers: ["NOR","PIA"] },
  { id: "RBR", name: "Red Bull",     pts: 8,  color: "#1E41FF", drivers: ["VER","HAD"] },
  { id: "HAS", name: "Haas",         pts: 6,  color: "#FFFFFF", drivers: ["BEA","HUL"] },
  { id: "VCR", name: "Racing Bulls", pts: 4,  color: "#6692FF", drivers: ["LIN","LAW"] },
  { id: "AUD", name: "Audi",         pts: 2,  color: "#e8091e", drivers: ["BOR"] },
  { id: "ALP", name: "Alpine",       pts: 1,  color: "#0090FF", drivers: ["GAS","COL"] },
  { id: "WIL", name: "Williams",     pts: 0,  color: "#64C4FF", drivers: ["SAI","ALB"] },
  { id: "AST", name: "Aston Martin", pts: 0,  color: "#006F62", drivers: ["ALO","STR"] },
];

export const COMP_COLOR = {
  SOFT: "#e10600", MEDIUM: "#f5c518", HARD: "#d8d8d8",
  INTERMEDIATE: "#00c878", WET: "#4488ff",
};

export function predictChampionship(driverList) {
  return driverList.map(d => {
    const carFactor = { Mercedes: 1.18, Ferrari: 1.08, McLaren: 1.06, "Red Bull": 1.04 }[d.team] ?? 0.90;
    const avgRating = Object.values(d.ratings).reduce((a,b) => a+b,0) / Object.keys(d.ratings).length;
    const ratePerRace = d.pts / COMPLETED_ROUNDS;
    const projectedPts = Math.round(d.pts + (ratePerRace * carFactor * (avgRating/90) * REMAINING_ROUNDS));
    const confidence = Math.min(99, Math.round((projectedPts / (TOTAL_ROUNDS * 22)) * 100 * (avgRating/90)));
    return { ...d, projectedPts, confidence };
  }).sort((a,b) => b.projectedPts - a.projectedPts);
}

export function predictRaceWinner(race, driverList) {
  return driverList.slice(0,6).map(d => {
    const isFav = (race.favorites || []).includes(d.id);
    const base = (d.ratings.pace * 0.35 + d.ratings.qualifying * 0.25 + d.ratings.racecraft * 0.25 + d.ratings.consistency * 0.15);
    const boost = isFav ? 8 : 0;
    const carBoost = { Mercedes: 12, Ferrari: 7, McLaren: 5, "Red Bull": 4 }[d.team] ?? 0;
    const rawScore = base + boost + carBoost + Math.random() * 3;
    return { ...d, rawScore };
  }).sort((a,b) => b.rawScore - a.rawScore).map((d, i) => ({
    ...d, winPct: Math.max(2, Math.round([38,22,15,10,8,5,2][i] * ((d.rawScore/110))))
  }));
}

export function formatLap(s) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(3).padStart(6, "0")}`;
}
