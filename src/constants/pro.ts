
export type ProPlanId = 'monthly' | 'annual' | 'lifetime';

export interface ProPlan {
  id: ProPlanId;
  productId: string;
  title: string;
  price: string;
  priceValue: number;
  cadence: string;
  perMonth: string | null;
  note: string | null;
}

const MONTHLY_PRICE = 2.99;
const ANNUAL_PRICE = 19.99;

export const ANNUAL_SAVING_PERCENT = Math.round((1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100);

export const PRO_PLANS: ProPlan[] = [
  {
    id: 'monthly',
    productId: 'ironmind_pro_monthly',
    title: 'MONTHLY',
    price: '$2.99',
    priceValue: MONTHLY_PRICE,
    cadence: 'per month',
    perMonth: null,
    note: null,
  },
  {
    id: 'annual',
    productId: 'ironmind_pro_annual',
    title: 'ANNUAL',
    price: '$19.99',
    priceValue: ANNUAL_PRICE,
    cadence: 'per year',
    perMonth: '$1.66/mo',
    note: `SAVE ${ANNUAL_SAVING_PERCENT}%`,
  },
  {
    id: 'lifetime',
    productId: 'ironmind_pro_lifetime',
    title: 'LIFETIME',
    price: '$39.99',
    priceValue: 39.99,
    cadence: 'one-time',
    perMonth: null,
    note: 'PAY ONCE',
  },
];

export const discountPercent = (planId: ProPlanId): number => {
  const full = PRO_PLANS.find((p) => p.id === planId);
  const sale = WELCOME_PLANS.find((p) => p.id === planId);
  if (!full || !sale) return 0;
  return Math.round((1 - sale.priceValue / full.priceValue) * 100);
};

export const MAX_WELCOME_DISCOUNT = (): number =>
  Math.max(...(['monthly', 'annual', 'lifetime'] as ProPlanId[]).map(discountPercent));

export const WELCOME_PLANS: ProPlan[] = [
  {
    id: 'monthly',
    productId: 'ironmind_pro_monthly',
    title: 'MONTHLY',
    price: '$1.99',
    priceValue: 1.99,
    cadence: 'per month',
    perMonth: null,
    note: 'WAS $2.99',
  },
  {
    id: 'annual',
    productId: 'ironmind_pro_annual',
    title: 'ANNUAL',
    price: '$14.99',
    priceValue: 14.99,
    cadence: 'per year',
    perMonth: '$1.25/mo',
    note: 'WAS $19.99',
  },
  {
    id: 'lifetime',
    productId: 'ironmind_pro_lifetime_welcome',
    title: 'LIFETIME',
    price: '$29.99',
    priceValue: 29.99,
    cadence: 'one-time',
    perMonth: null,
    note: 'WAS $39.99',
  },
];

export const PRO_FEATURES = [
  {
    icon: '❄',
    title: '20 Streak Freezes / Month',
    body: 'Each freeze automatically shields one missed challenge so a single slip never kills a long streak.',
  },
  {
    icon: '◉',
    title: 'Double Coins (2×)',
    body: 'Earn twice the coins on every challenge win and perfect day — unlock frames and name effects twice as fast.',
  },
  {
    icon: '◑',
    title: 'All 9 Themes + Aurora Frame',
    body: 'Instant access to every dark palette plus the Pro-exclusive Aurora prism avatar frame.',
  },
  {
    icon: '⚔',
    title: 'High-Stakes Duels (◉ 100 & ◉ 250)',
    body: 'Raise the stakes against friends for up to ◉ 500 pots on 24-hour screen-time showdowns.',
  },
  {
    icon: '✦',
    title: '7 Pinnable Elite Badges & 30-Day Analytics',
    body: 'Pin any earned elite badge next to your name on the leaderboard, plus deep 30-day charts and weekly fight grades.',
  },
];

export const PRO_COMPARISON: { label: string; free: string; pro: string }[] = [
  { label: 'Scroll-Only Protection (Big 5)', free: 'Full', pro: 'Full' },
  { label: 'Streak Freezes', free: 'Buy (◉ 100)', pro: '20 / month' },
  { label: 'Coins per Win', free: '1× (+10)', pro: '2× (+20)' },
  { label: 'Themes & Exclusive Frame', free: '1 free gift', pro: 'All 9 + Aurora' },
  { label: 'Duel Max Stake', free: 'Free / ◉ 50', pro: 'Up to ◉ 250' },
  { label: 'Leaderboard Elite Badge', free: '—', pro: 'Pin any of 7' },
  { label: 'Analytics & Fight Grade', free: '7-day', pro: '30-day + Coach' },
];
