// IronMind Pro plans and the feature list the paywall sells.
//
// Product IDs are the identifiers that must be created verbatim in the Play Console before
// billing can work. They're defined here rather than inline so wiring real purchases later
// is a matter of importing this list, not hunting for strings.

export type ProPlanId = 'monthly' | 'annual' | 'lifetime';

export interface ProPlan {
  id: ProPlanId;
  productId: string;
  title: string;
  price: string;
  priceValue: number;
  cadence: string;
  // Non-null only where a per-month equivalent is meaningful (i.e. not one-off purchases).
  perMonth: string | null;
  note: string | null;
}

const MONTHLY_PRICE = 2.99;
const ANNUAL_PRICE = 19.99;

// Computed rather than hardcoded so the badge can never contradict the prices next to it.
// A hand-written "SAVE 45%" silently becomes false the moment either price is edited, and
// an overstated saving on a paid subscription is exactly the kind of claim store review
// teams reject.
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

export const PRO_FEATURES = [
  {
    icon: '❄',
    title: 'Streak Protection',
    body: 'Streak freezes absorb a failed challenge so one slip does not erase weeks of work.',
  },
  {
    icon: '◑',
    title: 'Exclusive Themes',
    body: 'Cyberpunk and other dark UI themes, plus Pro-only accent colours.',
  },
  {
    icon: '✦',
    title: 'Elite Badges',
    body: 'Pro-only achievement badges shown next to your name on the leaderboard.',
  },
  {
    icon: '◈',
    title: 'Advanced Analytics',
    body: 'Full screen-time history, per-app trends and detailed progress reports.',
  },
];
