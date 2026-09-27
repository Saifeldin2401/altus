import { addIntegration, replayIntegration } from '@sentry/react'

/**
 * Session Replay is ~250 kB. It lives in its own module so main.tsx can load it
 * after first paint instead of shipping it in the entry chunk. The sample rates
 * stay on Sentry.init() - the integration reads them from the client options.
 */
export function addSentryReplay() {
  addIntegration(replayIntegration())
}
