# Event Marking

PubSub has at-least-once delivery semantics, meaning messages may occasionally be delivered more than once. For operations that must be executed exactly once (like payment processing or credit awards), this library provides event marking.

## How It Works

The `markEvent` option uses your provided storage to track which event IDs have already been processed. When enabled:

1. Before processing, the handler checks if the event ID was already processed
2. If already processed, the handler skips execution and logs a notice
3. After successful processing, the event ID is marked as processed

## Setup

Provide your own `isEventProcessed` and `markEventAsProcessed` functions when creating the typed PubSub client. These functions typically use Redis or a similar fast key-value store.

```typescript
import { PubSub } from "@google-cloud/pubsub";
import { createTypedPubsub } from "@codecompose/typed-pubsub";
import { redis } from "./redis-client";

const eventMarkingFunctions = {
  isEventProcessed: async (eventId: string) => {
    return Boolean(await redis.get(`event:${eventId}`));
  },
  markEventAsProcessed: async (eventId: string) => {
    await redis.set(`event:${eventId}`, "1", "EX", 86400); // 24h TTL
  },
};

export const pubsub = createTypedPubsub({
  client: new PubSub(),
  schemas,
  region: "us-central1",
  options: {
    eventMarkingFunctions,
    defaultHandlerOptions: {
      vpcConnector: "redis-connector", // If Redis is in a VPC
    },
  },
});
```

## Enabling Per Handler

Event marking requires two conditions to be met:

1. `eventMarkingFunctions` must be provided in the client options
2. `markEvent: true` must be set on the handler (either globally or per-handler)

```typescript
// Enable for a specific handler
export const handle_payment = pubsub.createHandler({
  topic: "process_payment",
  handler: async (data) => {
    // This will never run twice for the same event
    await chargeCustomer(data.customerId, data.amount);
  },
  options: {
    markEvent: true,
  },
});

// Or enable globally for all handlers
const pubsub = createTypedPubsub({
  client: new PubSub(),
  schemas,
  region: "us-central1",
  options: {
    eventMarkingFunctions,
    defaultHandlerOptions: {
      markEvent: true,
    },
  },
});
```

## VPC Connector

If your Redis instance is inside a VPC (common in production), you need to configure a VPC connector so Cloud Functions can reach it:

```typescript
options: {
  defaultHandlerOptions: {
    vpcConnector: "redis-connector",
    markEvent: true,
  },
}
```

This can also be set per-handler if only some handlers need VPC access.
