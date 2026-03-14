# Stale Events

For time-sensitive operations, you may want to discard messages that are too old. The `retryMaxAgeMinutes` option automatically drops events that exceed the specified age, preventing the processing of stale data during retry storms.

## How It Works

When a handler receives an event with `retryMaxAgeMinutes` configured, it compares the event timestamp to the current time. If the event is older than the configured limit, processing is skipped and an error is logged.

This is particularly useful when:

- Events trigger notifications that are no longer relevant after some time
- Retries have been accumulating due to a downstream outage
- Processing stale data could cause incorrect state updates

## Usage

```typescript
export const handle_notifications = pubsub.createHandler({
  topic: "send_notification",
  handler: async (data) => {
    await sendPushNotification(data.userId, data.message);
  },
  options: {
    retryMaxAgeMinutes: 60, // Drop events older than 1 hour
  },
});
```

You can use the exported `HOUR_MINUTES` constant for readability:

```typescript
import { HOUR_MINUTES } from "@codecompose/typed-pubsub";

options: {
  retryMaxAgeMinutes: 48 * HOUR_MINUTES, // Drop events older than 48 hours
}
```

## Setting a Global Default

If most of your handlers should drop stale events, set it as a default:

```typescript
const pubsub = createTypedPubsub({
  client: new PubSub(),
  schemas,
  region: "us-central1",
  options: {
    defaultHandlerOptions: {
      retryMaxAgeMinutes: 48 * HOUR_MINUTES,
    },
  },
});
```

Individual handlers can still override this value or set it to `undefined` to disable the limit.

::: warning Retry behavior
The `retryMaxAgeMinutes` setting only controls when to drop events on the receiving end. It does not affect the PubSub subscription's retry schedule, which is governed by the ACK deadline. Events will continue to be redelivered until they are acknowledged or the subscription's message retention period expires.
:::
