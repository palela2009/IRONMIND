import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Read from app.json rather than hardcoded, so the DSN can be swapped without touching code.
// Empty until a Sentry project exists, and everything below is a no-op in that state - the
// app must not depend on crash reporting being configured.
const DSN = (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ?? '';

export const CRASH_REPORTING_ENABLED = DSN.length > 0 && !__DEV__;

export const initCrashReporting = (): void => {
  if (!CRASH_REPORTING_ENABLED) return;

  Sentry.init({
    dsn: DSN,
    // Crashes only. Performance tracing would sample ordinary sessions and burn the free
    // tier's quota on data that says nothing about why the app broke.
    tracesSampleRate: 0,
    // Never attach emails, usernames or IP addresses. A crash report needs to identify a
    // build and a code path, not a person.
    sendDefaultPii: false,
    environment: __DEV__ ? 'development' : 'production',
  });
};

// Anonymous account id only. Enough to tell "this crashes for one unlucky account" apart
// from "this crashes for everyone", without shipping anything that identifies who they are.
export const setCrashUser = (uid: string | null): void => {
  if (!CRASH_REPORTING_ENABLED) return;
  Sentry.setUser(uid ? { id: uid } : null);
};

// For failures the app already handles but should still know about - a purchase that was
// refused, a sync that never succeeded - which otherwise disappear into a catch block.
export const reportHandledError = (error: unknown, context?: Record<string, unknown>): void => {
  if (!CRASH_REPORTING_ENABLED) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
};

// A short trail of what happened before a crash. Far more useful than the stack alone when
// the bug is a sequence rather than a single bad call.
export const leaveBreadcrumb = (message: string, data?: Record<string, unknown>): void => {
  if (!CRASH_REPORTING_ENABLED) return;
  Sentry.addBreadcrumb({ message, data, level: 'info' });
};
