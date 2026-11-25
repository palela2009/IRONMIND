module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || config.extra?.sentryDsn || '',
    revenuecatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || config.extra?.revenuecatAndroidKey || '',
  },
});
