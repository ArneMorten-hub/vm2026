export type Team = { name: string; flag: string };

export type GroupData = {
  teams: Team[];
  md1: string; md2: string; md3: string;
};

export const groups: Record<string, GroupData> = {
  A: { teams: [{ name: "Mexico", flag: "🇲🇽" }, { name: "South Africa", flag: "🇿🇦" }, { name: "South Korea", flag: "🇰🇷" }, { name: "Czechia", flag: "🇨🇿" }], md1: "2026-06-11", md2: "2026-06-18", md3: "2026-06-25" },
  B: { teams: [{ name: "Canada", flag: "🇨🇦" }, { name: "Bosnia and Herzegovina", flag: "🇧🇦" }, { name: "Qatar", flag: "🇶🇦" }, { name: "Switzerland", flag: "🇨🇭" }], md1: "2026-06-12", md2: "2026-06-18", md3: "2026-06-25" },
  C: { teams: [{ name: "Brazil", flag: "🇧🇷" }, { name: "Morocco", flag: "🇲🇦" }, { name: "Haiti", flag: "🇭🇹" }, { name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" }], md1: "2026-06-13", md2: "2026-06-19", md3: "2026-06-25" },
  D: { teams: [{ name: "USA", flag: "🇺🇸" }, { name: "Paraguay", flag: "🇵🇾" }, { name: "Australia", flag: "🇦🇺" }, { name: "Turkey", flag: "🇹🇷" }], md1: "2026-06-12", md2: "2026-06-19", md3: "2026-06-25" },
  E: { teams: [{ name: "Germany", flag: "🇩🇪" }, { name: "Curaçao", flag: "🇨🇼" }, { name: "Ivory Coast", flag: "🇨🇮" }, { name: "Ecuador", flag: "🇪🇨" }], md1: "2026-06-14", md2: "2026-06-20", md3: "2026-06-26" },
  F: { teams: [{ name: "Netherlands", flag: "🇳🇱" }, { name: "Japan", flag: "🇯🇵" }, { name: "Sweden", flag: "🇸🇪" }, { name: "Tunisia", flag: "🇹🇳" }], md1: "2026-06-14", md2: "2026-06-20", md3: "2026-06-26" },
  G: { teams: [{ name: "Belgium", flag: "🇧🇪" }, { name: "Egypt", flag: "🇪🇬" }, { name: "Iran", flag: "🇮🇷" }, { name: "New Zealand", flag: "🇳🇿" }], md1: "2026-06-15", md2: "2026-06-21", md3: "2026-06-26" },
  H: { teams: [{ name: "Spain", flag: "🇪🇸" }, { name: "Cape Verde", flag: "🇨🇻" }, { name: "Saudi Arabia", flag: "🇸🇦" }, { name: "Uruguay", flag: "🇺🇾" }], md1: "2026-06-15", md2: "2026-06-21", md3: "2026-06-26" },
  I: { teams: [{ name: "France", flag: "🇫🇷" }, { name: "Senegal", flag: "🇸🇳" }, { name: "Iraq", flag: "🇮🇶" }, { name: "Norway", flag: "🇳🇴" }], md1: "2026-06-16", md2: "2026-06-22", md3: "2026-06-27" },
  J: { teams: [{ name: "Argentina", flag: "🇦🇷" }, { name: "Algeria", flag: "🇩🇿" }, { name: "Austria", flag: "🇦🇹" }, { name: "Jordan", flag: "🇯🇴" }], md1: "2026-06-16", md2: "2026-06-22", md3: "2026-06-27" },
  K: { teams: [{ name: "Portugal", flag: "🇵🇹" }, { name: "DR Congo", flag: "🇨🇩" }, { name: "Uzbekistan", flag: "🇺🇿" }, { name: "Colombia", flag: "🇨🇴" }], md1: "2026-06-17", md2: "2026-06-23", md3: "2026-06-27" },
  L: { teams: [{ name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" }, { name: "Croatia", flag: "🇭🇷" }, { name: "Ghana", flag: "🇬🇭" }, { name: "Panama", flag: "🇵🇦" }], md1: "2026-06-18", md2: "2026-06-24", md3: "2026-06-27" },
};

export type MatchSeed = {
  homeTeam: string; awayTeam: string;
  stage: string; groupName: string | null;
  matchday: number | null; matchDate: string | null;
  matchTime: string; label: string | null;
};

export function generateGroupMatches(): MatchSeed[] {
  const matches: MatchSeed[] = [];
  // Default times (approximate CEST) - admin can update
  const times = ["18:00", "21:00", "21:00", "00:00", "21:00", "21:00"];
  for (const [groupName, g] of Object.entries(groups)) {
    const t = g.teams;
    const pairs: [number, number, number, string][] = [
      [0, 1, 1, g.md1], [2, 3, 1, g.md1],
      [0, 2, 2, g.md2], [1, 3, 2, g.md2],
      [0, 3, 3, g.md3], [1, 2, 3, g.md3],
    ];
    for (let i = 0; i < pairs.length; i++) {
      const [hi, ai, matchday, date] = pairs[i];
      matches.push({ homeTeam: t[hi].name, awayTeam: t[ai].name, stage: "group", groupName, matchday, matchDate: date, matchTime: times[i], label: null });
    }
  }
  return matches;
}

export function generateKnockoutMatches(): MatchSeed[] {
  const rounds = [
    { stage: "r32", matchDate: "2026-06-29", matchTime: "21:00", labels: [
      "Vinner gruppe A vs 3.plass C/D/E/F", "Vinner gruppe C vs Vinner gruppe D",
      "Vinner gruppe B vs 3.plass A/B/C/D", "Vinner gruppe D vs Vinner gruppe A",
      "Vinner gruppe E vs 3.plass G/H/I/J", "Vinner gruppe G vs Vinner gruppe H",
      "Vinner gruppe F vs 3.plass E/F/G/H", "Vinner gruppe H vs Vinner gruppe E",
      "Vinner gruppe I vs 3.plass K/L/A/B", "Vinner gruppe K vs Vinner gruppe L",
      "Vinner gruppe J vs 3.plass I/J/K/L", "Vinner gruppe L vs Vinner gruppe K",
      "2.plass gruppe B vs 2.plass gruppe A", "2.plass gruppe D vs 2.plass gruppe C",
      "2.plass gruppe F vs 2.plass gruppe E", "2.plass gruppe H vs 2.plass gruppe G",
    ]},
    { stage: "r16", matchDate: "2026-07-03", matchTime: "21:00", labels: [
      "Åttedelsfinale 1", "Åttedelsfinale 2", "Åttedelsfinale 3", "Åttedelsfinale 4",
      "Åttedelsfinale 5", "Åttedelsfinale 6", "Åttedelsfinale 7", "Åttedelsfinale 8",
    ]},
    { stage: "qf", matchDate: "2026-07-10", matchTime: "21:00", labels: ["Kvartfinale 1", "Kvartfinale 2", "Kvartfinale 3", "Kvartfinale 4"] },
    { stage: "sf", matchDate: "2026-07-14", matchTime: "21:00", labels: ["Semifinale 1", "Semifinale 2"] },
    { stage: "3rd", matchDate: "2026-07-18", matchTime: "21:00", labels: ["Bronsefinale"] },
    { stage: "final", matchDate: "2026-07-19", matchTime: "21:00", labels: ["VM-finale 🏆"] },
  ];
  const matches: MatchSeed[] = [];
  for (const r of rounds) {
    for (const label of r.labels) {
      matches.push({ homeTeam: "TBD", awayTeam: "TBD", stage: r.stage, groupName: null, matchday: null, matchDate: r.matchDate, matchTime: r.matchTime, label });
    }
  }
  return matches;
}

export const allTeams = Object.values(groups).flatMap(g => g.teams.map(t => t.name)).sort();

export const teamFlags: Record<string, string> = Object.values(groups).reduce((acc, g) => {
  for (const t of g.teams) acc[t.name] = t.flag;
  return acc;
}, {} as Record<string, string>);

// Special categories (20 pts each)
export const specialCategories = [
  { id: "champion",          label: "🏆 Seierherrer",               desc: "Navn på laget som vinner VM",               type: "team",   points: 20 },
  { id: "runner_up",         label: "🥈 Finalist",                  desc: "Navn på laget som taper finalen",           type: "team",   points: 10 },
  { id: "top_scorer",        label: "⚽ Toppscorer",                 desc: "Navn på toppscoreren",                      type: "player", points: 10 },
  { id: "first_goal",        label: "🚀 Første målscorer",           desc: "Navn på spiller som scorer turneringens første mål", type: "player", points: 10 },
  { id: "most_goals_team",   label: "🔥 Mestscorende lag",           desc: "Navn på laget som scorer flest mål",        type: "team",   points: 10 },
  { id: "best_defense",      label: "🧱 Beste forsvar",              desc: "Navn på laget som slipper inn færrest mål", type: "team",   points: 10 },
  { id: "total_goals",       label: "📊 Totalt antall mål",          desc: "Antall mål scoret i turneringen",           type: "number", points: 10 },
  { id: "red_card_team",     label: "🐷 Griselag",                   desc: "Navn på laget som får rødt kort",           type: "team",   points: 10 },
  { id: "penalty_shootouts", label: "🎯 Antall straffekonker",       desc: "Antall straffekonkurranser i turneringen",  type: "number", points: 10 },
  { id: "golden_glove",      label: "🧤 Golden Glove",               desc: "Navn på beste keeper",                      type: "player", points: 10 },
];
