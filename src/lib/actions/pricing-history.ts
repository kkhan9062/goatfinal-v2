'use server';

import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { computePricingSuggestion, type PricingSuggestion } from '@/lib/pricing-history';

const ORGANS = ['mundi', 'kaleji', 'paya', 'vajdi', 'gurda'] as const;

export async function getPricingSuggestion(
  customerId: string,
  organType: string
): Promise<PricingSuggestion> {
  await requireUser();
  if (!customerId || !organType) {
    return computePricingSuggestion([]);
  }

  const history = await prisma.pricingHistory.findMany({
    where: { customerId, organType },
    orderBy: { date: 'desc' },
    take: 10,
  });

  return computePricingSuggestion(history.map((h) => ({ rate: Number(h.rate), date: h.date })));
}

export type RetailerPricingHistory = {
  organType: string;
  entries: { id: string; date: Date; rate: number }[];
};

/** Full raw history for one retailer, grouped by organ, most-recent-first — the browse view. */
export async function getRetailerPricingHistory(customerId: string): Promise<RetailerPricingHistory[]> {
  await requireUser();
  if (!customerId) return [];

  const rows = await prisma.pricingHistory.findMany({
    where: { customerId },
    orderBy: { date: 'desc' },
  });

  return ORGANS.map((organType) => ({
    organType,
    entries: rows
      .filter((r) => r.organType === organType)
      .map((r) => ({ id: r.id, date: r.date, rate: Number(r.rate) })),
  })).filter((g) => g.entries.length > 0);
}
