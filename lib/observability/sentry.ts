import * as Sentry from "@sentry/nextjs";

type SentryContext = {
  contexts?: Record<string, Record<string, unknown>>;
  extras?: Record<string, unknown>;
  tags?: Record<string, string | number | boolean | null | undefined>;
  user?: {
    email?: string | null;
    id?: string | null;
  };
};

let sentryInitialized = false;

function initSentry() {
  if (sentryInitialized || !process.env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
  });

  sentryInitialized = true;
}

export function captureServerException(
  error: unknown,
  context?: SentryContext,
) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  initSentry();

  Sentry.withScope((scope) => {
    if (context?.user?.id || context?.user?.email) {
      scope.setUser({
        id: context.user.id ?? undefined,
        email: context.user.email ?? undefined,
      });
    }

    Object.entries(context?.tags ?? {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        scope.setTag(key, String(value));
      }
    });

    Object.entries(context?.extras ?? {}).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    Object.entries(context?.contexts ?? {}).forEach(([key, value]) => {
      scope.setContext(key, value);
    });

    Sentry.captureException(error);
  });
}
