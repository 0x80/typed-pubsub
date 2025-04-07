export const HOUR_MINUTES = 60;
export const MINUTE_MS = 60 * 1000;

/** Default options for Pubsub handlers */
export const defaultHandlerOptions = {
  retry: true,
  retryMaxAgeMinutes: undefined, // No limit on retry age by default
  memory: "512MiB",
  markEvent: false,
  timeoutSeconds: 20,
  vpcConnector: undefined,
  maxInstances: 250,
} as const;
