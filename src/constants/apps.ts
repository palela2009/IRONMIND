export const APPS_LIST = ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'X (Twitter)', 'Reddit', 'Snapchat'];

const APP_COLORS: Record<string, string> = {
  Instagram: '#833AB4',
  YouTube: '#FF0000',
  TikTok: '#010101',
  Facebook: '#1877F2',
  'X (Twitter)': '#14171A',
  Reddit: '#FF4500',
  Snapchat: '#FFFC00',
};

const APP_ICONS: Record<string, string> = {
  Instagram: 'IG',
  YouTube: 'YT',
  TikTok: 'TK',
  Facebook: 'FB',
  'X (Twitter)': 'X',
  Reddit: 'RD',
  Snapchat: 'SC',
};

const FALLBACK_PALETTE = ['#4C6EF5', '#12B886', '#F59F00', '#E64980', '#7048E8', '#15AABF', '#FA5252'];

export const colorForApp = (app: string): string => {
  if (APP_COLORS[app]) return APP_COLORS[app];
  let hash = 0;
  for (let i = 0; i < app.length; i++) hash = (hash * 31 + app.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
};

export const abbrForApp = (app: string): string => {
  if (APP_ICONS[app]) return APP_ICONS[app];
  const words = app.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return app.slice(0, 2).toUpperCase();
};
