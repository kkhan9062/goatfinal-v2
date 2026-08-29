// ============================================================================
// AI Pricing Suggestion — direct port of v1's ai-pricing.js math, kept as a
// pure function (no Prisma/framework import) so it's unit-testable in
// isolation from the query that fetches the history — see
// pricing-history.test.ts. Callers (server actions, UI) fetch history
// ordered most-recent-first and pass it straight in.
// ============================================================================

export type PricingHistoryEntry = { rate: number; date: Date };

export type PricingTrend = 'no_data' | 'increasing' | 'decreasing' | 'stable';

export type PricingSuggestion = {
  suggestion: number | null;
  lastPrice: number | null;
  secondLastPrice: number | null;
  averagePrice: number | null;
  trend: PricingTrend;
  message: string;
  historyCount: number;
};

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * `history` must already be sorted most-recent-first (history[0] is the
 * latest rate charged). Suggests a rate based on the last price, the trend
 * versus the price before it, and a weighted average of the last 5 prices
 * when that average diverges meaningfully from the last price.
 */
export function computePricingSuggestion(history: PricingHistoryEntry[]): PricingSuggestion {
  if (history.length === 0) {
    return {
      suggestion: null,
      lastPrice: null,
      secondLastPrice: null,
      averagePrice: null,
      trend: 'no_data',
      message: 'No historical pricing data available for this retailer and organ type.',
      historyCount: 0,
    };
  }

  const lastPrice = history[0].rate;
  const secondLastPrice = history.length > 1 ? history[1].rate : null;

  const recentPrices = history.slice(0, 5).map((h) => h.rate);
  const averagePrice = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;

  let trend: PricingTrend = 'stable';
  let suggestion = lastPrice;

  if (secondLastPrice !== null) {
    const percentChange = ((lastPrice - secondLastPrice) / secondLastPrice) * 100;
    if (percentChange > 5) {
      trend = 'increasing';
      suggestion = lastPrice * 1.02;
    } else if (percentChange < -5) {
      trend = 'decreasing';
      suggestion = lastPrice * 0.98;
    } else {
      trend = 'stable';
      suggestion = lastPrice;
    }
  }

  if (averagePrice && Math.abs(averagePrice - lastPrice) / lastPrice > 0.1) {
    suggestion = (lastPrice + averagePrice) / 2;
  }

  suggestion = Math.round(suggestion * 100) / 100;

  let message =
    trend === 'increasing'
      ? `Price trend is increasing. Last price: ₹${money(lastPrice)}, Suggested: ₹${money(suggestion)}`
      : trend === 'decreasing'
        ? `Price trend is decreasing. Last price: ₹${money(lastPrice)}, Suggested: ₹${money(suggestion)}`
        : `Price is stable. Last price: ₹${money(lastPrice)}, Suggested: ₹${money(suggestion)}`;

  if (secondLastPrice !== null) {
    message += ` (Previous: ₹${money(secondLastPrice)})`;
  }

  return {
    suggestion,
    lastPrice,
    secondLastPrice,
    averagePrice,
    trend,
    message,
    historyCount: history.length,
  };
}
