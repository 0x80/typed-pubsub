import type { CloudEvent } from "firebase-functions/v2";

export function shouldDropEvent(
  event: CloudEvent<unknown>,
  maxAgeMinutes?: number,
) {
  // If maxAgeMinutes is undefined, we don't drop events based on age
  if (maxAgeMinutes === undefined) {
    return false;
  }

  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  const eventAge = Date.now() - Date.parse(event.time);

  if (eventAge > maxAgeMs) {
    /** Dropping event due to max age reached */
    console.error(
      new Error(
        `Dropping event ${event.type} for ${event.source} because max age (${String(maxAgeMinutes)} minutes) was reached.`,
      ),
    );
    return true;
  }

  return false;
}

export function getEventAgeSeconds(event: CloudEvent<unknown>) {
  return (Date.now() - Date.parse(event.time)) / 1000;
}
