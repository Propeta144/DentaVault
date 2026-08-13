// Validated na categorical palette (light mode, safe sa adjacent-pairlist
// — tignan yung dataviz skill's palette.md / validate_palette.js). Fixed
// order 'to; naka-assign yung slots sa entities base sa POSITION, hindi na
// ire-resort base sa value, kaya laging nasa loob ng pairing na chinek ng
// validator yung rendered adjacency. Sinadya na hiwalay 'to sa odontogram
// colors ng constants/dental.js (raw at unvalidated na Tailwind hues yun,
// ginagamit na sa ibang parte ng app) — dito sa dashboard, validated set
// lang ang re-reuse.
const CATEGORICAL = [
  '#2a78d6', // slot 1 — blue
  '#eb6834', // slot 2 — orange
  '#1baf7a', // slot 3 — aqua
  '#eda100', // slot 4 — yellow
  '#e87ba4', // slot 5 — magenta
]

// Single hue lang para sa "count per nominal category, one metric" na mga
// bar chart (hal. procedure breakdown) — parehong kulay lahat ng bar; yung
// haba ng bar na lang ang nagdadala ng comparison, base sa dataviz skill's
// color-formula.md.
export const SEQUENTIAL_HUE = CATEGORICAL[0]

// Fixed display order para sa condition breakdown chart — HINDI sorted by
// count, para stable at validated pa rin yung categorical color assignment
// (kung sorted by value, baka magkatabi na yung kahit anong dalawang kulay,
// tapos sa fixed sequence na 'to lang naman na-check yung palette). Yung
// "Extracted", wala nang ngipin, hindi 'to active condition, kaya muted
// chrome gray (slate-400) na lang ang gamit dito sa halip na gumamit pa ng
// categorical identity slot — low-chroma hue naman, parang gray lang din
// babasahin, bagsak din sa identity-hue check e.
export const CONDITION_CHART_ORDER = [
  { code: 'healthy', label: 'Healthy', color: CATEGORICAL[0] },
  { code: 'filling', label: 'Filling / Restored', color: CATEGORICAL[1] },
  { code: 'root_canal', label: 'Root Canal', color: CATEGORICAL[2] },
  { code: 'crown', label: 'Crown / Bridge', color: CATEGORICAL[3] },
  { code: 'caries', label: 'Caries', color: CATEGORICAL[4] },
  { code: 'extracted', label: 'Extracted / Missing', color: '#94a3b8' },
]

// Yung two-series charts (monthly trend), kinukuha nila yung unang dalawang
// categorical slots.
export const TREND_SERIES = {
  newPatients: { label: 'New Patients', color: CATEGORICAL[0] },
  treatments: { label: 'Treatments', color: CATEGORICAL[1] },
}
