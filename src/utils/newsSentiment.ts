/**
 * Lightweight frontend-only sentiment scoring for news headlines.
 * Zero backend cost — uses keyword matching. Not a replacement for
 * real NLP, but fast and useful for surface-level tagging.
 */

import type { NewsItem } from '../types';

export type Sentiment = 'bullish' | 'bearish' | 'neutral';

// Keyword dictionaries (lowercase). Bullish = supportive for biofuel prices.
const BULLISH_KEYWORDS = [
  'surge', 'rally', 'rise', 'rises', 'rising', 'soar', 'soars', 'jump', 'jumps',
  'spike', 'spikes', 'gains', 'climb', 'climbs', 'higher', 'upward',
  'tighten', 'tightening', 'shortage', 'deficit', 'cut', 'cuts', 'banned', 'ban',
  'double-counting abolish', 'mandate increase', 'target raised', 'strict',
  'record high', 'above', 'over €', 'above €',
  'bullish', 'strong demand', 'pull demand', 'supply crunch', 'constraint',
  'delay', 'delayed', 'halt', 'halts', 'suspend', 'disruption',
  'phase out', 'phaseout', 'banned', 'restriction',
  'stimulus', 'subsidy', 'incentive', 'premium',
  'drought', 'flood', 'weather damage', 'crop failure',
  'strike', 'protest', 'blockade',
];

const BEARISH_KEYWORDS = [
  'fall', 'falls', 'falling', 'drop', 'drops', 'slide', 'slump', 'tumble',
  'plunge', 'plunges', 'decline', 'declines', 'lower', 'weaker', 'weakened',
  'oversupply', 'surplus', 'glut', 'ample', 'abundant',
  'record low', 'below', 'under €',
  'bearish', 'weak demand', 'demand weakness', 'slowdown',
  'relaxation', 'delay mandate', 'postpone', 'cancellation', 'cancel',
  'exemption', 'waiver', 'relief', 'ease', 'easing', 'lifted', 'removed',
  'bumper', 'harvest surplus', 'good weather',
  'recession', 'slump', 'cooling',
];

/**
 * Score a single headline or piece of text.
 * Returns 'bullish', 'bearish', or 'neutral'.
 */
export function scoreText(text: string): Sentiment {
  const lower = text.toLowerCase();
  let bullish = 0;
  let bearish = 0;

  for (const kw of BULLISH_KEYWORDS) {
    if (lower.includes(kw)) bullish++;
  }
  for (const kw of BEARISH_KEYWORDS) {
    if (lower.includes(kw)) bearish++;
  }

  if (bullish > bearish + 0) return 'bullish';
  if (bearish > bullish + 0) return 'bearish';
  return 'neutral';
}

/**
 * Score a news item combining headline + price_impact text.
 */
export function scoreNews(item: NewsItem): Sentiment {
  const combined = `${item.headline} ${item.price_impact ?? ''}`;
  return scoreText(combined);
}

/**
 * Count sentiment distribution across an array of news items.
 */
export function sentimentDistribution(news: NewsItem[]): {
  bullish: number;
  bearish: number;
  neutral: number;
  overall: Sentiment;
} {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;

  for (const item of news) {
    const s = scoreNews(item);
    if (s === 'bullish') bullish++;
    else if (s === 'bearish') bearish++;
    else neutral++;
  }

  const overall: Sentiment =
    bullish > bearish ? 'bullish' :
    bearish > bullish ? 'bearish' :
    'neutral';

  return { bullish, bearish, neutral, overall };
}

/**
 * Get a badge color class for a sentiment.
 */
export function sentimentBadgeColor(sentiment: Sentiment): string {
  switch (sentiment) {
    case 'bullish':
      return 'text-positive bg-positive/10 border-positive/30';
    case 'bearish':
      return 'text-negative bg-negative/10 border-negative/30';
    default:
      return 'text-text-dim bg-surface border-border';
  }
}

/**
 * Get an arrow emoji for a sentiment.
 */
export function sentimentArrow(sentiment: Sentiment): string {
  switch (sentiment) {
    case 'bullish':
      return '⬆';
    case 'bearish':
      return '⬇';
    default:
      return '↔';
  }
}
