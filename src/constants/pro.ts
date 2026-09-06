
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

// Shown once, to a brand new account only. These are separate Play Console products from
// the standard plans rather than a discount applied at runtime, because a client cannot be
// trusted to decide what a user pays.
export const WELCOME_PLANS: ProPlan[] = [
  {
    id: 'monthly',
    productId: 'ironmind_pro_monthly_welcome',
    title: 'MONTHLY',
    price: '$1.99',
    priceValue: 1.99,
    cadence: 'per month',
    perMonth: null,
    note: 'WAS $2.99',
  },
  {
    id: 'annual',
    productId: 'ironmind_pro_annual_welcome',
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
    title: '20 Streak Freezes a Month',
    body: 'Each freeze absorbs one failed challenge automatically, so a single slip never wipes out a long run.',
  },
  {
    icon: '◑',
    title: 'Exclusive Themes',
    body: 'Cyberpunk and other dark UI themes, plus Pro-only accent colours.',
  },
  {
    icon: '✦',
    title: '7 Elite Badges',
    body: 'Pro-only badges for milestones like a 10-win run or a 2-second exit, shown next to your name on the leaderboard.',
  },
  {
    icon: '◈',
    title: 'Advanced Analytics',
    body: 'Full screen-time history, per-app trends and detailed progress reports.',
  },
];
