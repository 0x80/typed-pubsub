export const HOUR_MINUTES = 60;
export const MINUTE_MS = 60 * 1000;

/** Default options for Pubsub handlers */
export const defaultHandlerOptions = {
  retry: true,
  retryMaxAgeMinutes: undefined, // No limit on retry age by default
  memory: "512MiB",
  cpu: 1,
  timeoutSeconds: 20,
  maxInstances: 250,
  markEvent: false,
  vpcConnector: undefined,
} as const;
