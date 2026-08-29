'use client';

import { useEffect, useState } from 'react';
import { getPricingSuggestion } from '@/lib/actions/pricing-history';

const TREND_ICON: Record<string, string> = {
  increasing: '📈',
  decreasing: '📉',
  stable: '➡️',
  no_data: '',
};

export function RateSuggestion({
  customerId,
  organ,
  onApply,
}: {
  customerId: string;
  organ: string;
  onApply: (rate: number) => void;
}) {
  const [suggestion, setSuggestion] = useState<number | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [trend, setTrend] = useState<string>('no_data');

  useEffect(() => {
    let cancelled = false;
    if (!customerId) {
      setSuggestion(null);
      return;
    }
    getPricingSuggestion(customerId, organ).then((result) => {
      if (cancelled) return;
      setSuggestion(result.suggestion);
      setLastPrice(result.lastPrice);
      setTrend(result.trend);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId, organ]);

  if (!customerId || suggestion === null) return null;

  return (
    <div className="mt-1 flex items-center gap-1.5 text-xs text-indigo-300 whitespace-nowrap">
      <span>
        {TREND_ICON[trend]} 🤖 ₹{suggestion.toFixed(2)}
        {lastPrice !== null && lastPrice !== suggestion && (
          <span className="text-slate-500"> (last ₹{lastPrice.toFixed(2)})</span>
        )}
      </span>
      <button
        type="button"
        onClick={() => onApply(suggestion)}
        className="rounded bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 px-1.5 py-0.5 text-indigo-300"
      >
        Apply
      </button>
    </div>
  );
}
