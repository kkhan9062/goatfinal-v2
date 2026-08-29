import { describe, it, expect } from 'vitest';
import { computePricingSuggestion } from './pricing-history';

const d = (s: string) => new Date(s + 'T00:00:00Z');

describe('computePricingSuggestion', () => {
  it('returns no_data when there is no history', () => {
    const result = computePricingSuggestion([]);
    expect(result.trend).toBe('no_data');
    expect(result.suggestion).toBeNull();
  });

  it('suggests the last price unchanged when there is only one data point', () => {
    const result = computePricingSuggestion([{ rate: 200, date: d('2026-08-01') }]);
    expect(result.lastPrice).toBe(200);
    expect(result.secondLastPrice).toBeNull();
    expect(result.trend).toBe('stable');
    expect(result.suggestion).toBe(200);
  });

  it('detects an increasing trend (>5% up) and nudges the suggestion up 2%', () => {
    const result = computePricingSuggestion([
      { rate: 220, date: d('2026-08-08') }, // last
      { rate: 200, date: d('2026-08-01') }, // second-last: +10%
    ]);
    expect(result.trend).toBe('increasing');
    // averagePrice = 210, |210-220|/220 = 4.5% < 10%, so suggestion stays at last*1.02
    expect(result.suggestion).toBeCloseTo(220 * 1.02, 2);
  });

  it('detects a decreasing trend (>5% down) and nudges the suggestion down 2%', () => {
    const result = computePricingSuggestion([
      { rate: 180, date: d('2026-08-08') },
      { rate: 200, date: d('2026-08-01') }, // -10%
    ]);
    expect(result.trend).toBe('decreasing');
    expect(result.suggestion).toBeCloseTo(180 * 0.98, 2);
  });

  it('treats a small change (<=5%) as stable', () => {
    const result = computePricingSuggestion([
      { rate: 204, date: d('2026-08-08') }, // +2% vs 200
      { rate: 200, date: d('2026-08-01') },
    ]);
    expect(result.trend).toBe('stable');
    expect(result.suggestion).toBe(204);
  });

  it('pulls the suggestion toward the average of the last 5 when it diverges >10% from the last price', () => {
    const history = [
      { rate: 100, date: d('2026-08-05') }, // last
      { rate: 100, date: d('2026-08-04') },
      { rate: 300, date: d('2026-08-03') },
      { rate: 300, date: d('2026-08-02') },
      { rate: 300, date: d('2026-08-01') },
    ];
    // average of last 5 = (100+100+300+300+300)/5 = 220; |220-100|/100 = 120% > 10%
    const result = computePricingSuggestion(history);
    expect(result.averagePrice).toBe(220);
    // trend: secondLastPrice=100, no change -> stable, suggestion starts at 100,
    // then pulled toward average: (100+220)/2 = 160
    expect(result.suggestion).toBeCloseTo(160, 2);
  });

  it('only averages over the most recent 5 entries, not the full history', () => {
    const history = Array.from({ length: 8 }, (_, i) => ({ rate: 100, date: d('2026-08-01') }));
    history[0] = { rate: 500, date: d('2026-08-08') }; // last price spikes
    const result = computePricingSuggestion(history);
    // average of last 5 = (500+100+100+100+100)/5 = 180, not diluted by the 3 older 100s
    expect(result.averagePrice).toBe(180);
  });
});
