/* ==========================================================================
   BazarPeech — data & content contract
   --------------------------------------------------------------------------
   Single source of truth for the ILLUSTRATIVE demo values shown on the page.
   index.html currently renders these statically for no-JS / SEO; when a build
   step is added, render from here instead. main.js reads targets from the DOM,
   so this file stays declarative.

   PERFORMANCE INTEGRITY GATE: nothing in `performance` below is verified.
   Replace every value, and the equity path in index.html, with figures
   traceable to one test dataset + methodology before the site is published.
   ========================================================================== */
window.BZP = {
  /* hero "current market view" — illustrative, never call this live */
  market: {
    score: 0.73,            // 0..1 directional tendency
    instrument: "XAU/USD",
    price: "2,367.42",
    change: "+12.36 (+0.52%)",
    illustrative: true
  },

  /* trend recognition */
  trend: {
    score: 0.72,
    factors: ["Price action", "Trend structure", "Momentum", "Volatility", "Market-cycle context"],
    mlNote: "Machine-learning techniques optimise the weights and parameters inside the decision logic — they do not replace it."
  },

  /* THE JOURNEY OF A POSITION — the scroll animation in section 03.
     `closes` are real-shaped weekly XAU/USD prices, Jul 2023 – Apr 2024
     (indicative — swap in a verified data-provider series before publishing).
     `scores` are the model's illustrative directional read per bar (0..1).
     OHLC is derived from closes in main.js. A trend-aligned breakout fires at
     `triggerIndex`; the levels and sizing are illustrative, not a trading record. */
  journey: {
    instrument: "XAU/USD",
    timeframe: "weekly",
    range: "Jul 2023 – Apr 2024",
    note: "Indicative historical prices — not live data and not a trading record.",
    triggerIndex: 32,
    signalType: "Momentum breakout · aligned with trend",
    levels: { entry: 2083.0, sl: 2003.0, tp: 2243.0 },
    money: {
      equity: "$200,000",
      riskLine: "1.0% · $2,000",
      stopLine: "80 pts",
      perLotLine: "$8,000",
      size: "0.25 lots",
      rr: "1 : 2.0"
    },
    closes: [
      1865, 1960, 1965, 1943, 1943, 1913, 1890, 1940,
      1918, 1925, 1925, 1848, 1832, 1928, 1982, 2006,
      1993, 1940, 1981, 2002, 2072, 2005, 2019, 2053,
      2063, 2045, 2029, 2018, 2039, 2024, 2013, 2035,
      2083, 2179, 2156, 2166, 2233, 2330, 2344, 2392,
      2338
    ],
    scores: [
      0.498, 0.552, 0.567, 0.499, 0.48, 0.443, 0.347, 0.45,
      0.425, 0.472, 0.444, 0.332, 0.314, 0.452, 0.558, 0.582,
      0.599, 0.509, 0.566, 0.605, 0.686, 0.611, 0.581, 0.582,
      0.608, 0.57, 0.511, 0.499, 0.498, 0.534, 0.531, 0.586,
      0.9, 0.926, 0.858, 0.851, 0.91, 0.89, 0.864, 0.888,
      0.733
    ]
  },

  /* trigger signals */
  triggers: {
    pipeline: [
      { label: "Trend context confirmed", state: "done" },
      { label: "Scanning for signals",    state: "done" },
      { label: "Signal detected",         state: "active" },
      { label: "Validating conditions",   state: "" },
      { label: "Ready for risk assessment", state: "" }
    ],
    types: ["Breakout signals", "Pullback signals", "Momentum signals", "Volatility-based signals", "Pattern recognition"]
  },

  /* money management — illustrative position plan */
  money: {
    plan: {
      entry: "2,367.42",
      positionSize: "0.50 lots",
      stopLoss: "2,362.10",
      takeProfit: "2,380.50",
      riskReward: "1 : 2.5",
      expectedRisk: "1.2%"
    },
    rules: ["Adjust stop loss", "Partial take profit", "Position scaling",
            "Max concurrent positions", "Exposure control", "Real-time adaptation"]
  },

  /* PERFORMANCE — ILLUSTRATIVE ONLY. Do not ship. */
  performance: {
    label: "backtest",          // "backtest" | "paper" | "live"
    periodStart: "",
    periodEnd: "",
    instrument: "XAU/USD",
    totalReturn: 284,           // %
    sharpe: 1.8,
    winRate: 58,                // %
    maxDrawdown: -12,           // %
    totalTrades: 1247,
    methodologyNote: "Illustrative only — replace with verified backtest/live results plus period, sample size, spread/commission and slippage assumptions."
  },

  /* fundamental intelligence — roadmap, not deployed */
  roadmap: {
    deployed: false,
    intendedSources: ["Bloomberg", "Yahoo Finance", "CNBC", "Reuters"],
    downstream: ["New-position decisions", "Adjust existing positions", "Risk & exposure context", "Event-impact analysis"]
  },

  /* meeting request endpoint (existing server service) */
  meetingEndpoint: "/api/waitlist"
};
