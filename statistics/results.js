/* ===========================================================================
   Verified results for the Statistics page.

   Leave this as `null` until you have REAL, verifiable monthly returns —
   broker statements, or a third-party verified track record. While it is
   null the page renders clearly watermarked SAMPLE data for layout review,
   and deploy/deploy.sh refuses to publish the page to the live site.

   Every figure on the page (net profit, CAGR, max drawdown, Calmar, Sharpe,
   profitable months, the equity and drawdown charts, the monthly heatmap) is
   computed from `monthly` — nothing is typed in separately, so the numbers
   cannot disagree with each other.

   Format:

   window.BZP_RESULTS = {
     start: "2021-03",                  // first month, YYYY-MM
     startingBalance: 10000,            // shown as the equity curve's base
     monthly: [0.012, -0.004, 0.021],   // NET monthly returns as fractions (1.2% = 0.012),
                                        // after fees and costs, in date order, no gaps
     source: "Broker statements, verified by …",   // shown on the page
     asOf: "2026-08-31"                 // date of the last month-end included
   };
   ========================================================================= */
window.BZP_RESULTS = null;
