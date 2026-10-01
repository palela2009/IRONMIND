import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ?? '';

export const CRASH_REPORTING_ENABLED = DSN.length > 0 && !__DEV__;

export const initCrashReporting = (): void => {
  if (!CRASH_REPORTING_ENABLED) return;

  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    environment: __DEV__ ? 'development' : 'production',
  });
};

export const setCrashUser = (uid: string | null): void => {
  if (!CRASH_REPORTING_ENABLED) return;
  Sentry.setUser(uid ? { id: uid } : null);
};

export const reportHandledError = (error: unknown, context?: Record<string, unknown>): void => {
  if (!CRASH_REPORTING_ENABLED) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
};

export const leaveBreadcrumb = (message: string, data?: Record<string, unknown>): void => {
  if (!CRASH_REPORTING_ENABLED) return;
  Sentry.addBreadcrumb({ message, data, level: 'info' });
};
