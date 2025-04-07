# typed-pubsub

A type-safe PubSub abstraction for Google Cloud and Firebase.

## Features

- **Type-safe messaging**: Full TypeScript support for publishers and handlers
- **Runtime validation**: Schema validation using Zod prevents invalid messages
- **Duplicate prevention**: Optional event marking to prevent duplicate
  processing
- **Stale message handling**: Optional time-based dropping of messages
- **Customizable defaults**: Configure your own library-wide defaults with
  per-handler overrides. Out-of-the box you get:
  - Retries enabled with 7-day exponential backoff
  - Scale to maximum of 250 instances per topic (safer than Firebase's default
    of 3000)
  - 512MB memory allocation per instance

## Installation

```bash
npm install typed-pubsub
```

## Peer Dependencies

This package has the following peer dependencies:

- `@google-cloud/pubsub`
- `firebase-functions`
- `zod`

## Quick Start

1. Define your message schemas with Zod
2. Create a PubSub client
3. Initialize the typed PubSub with your schemas
4. Create type-safe publishers and handlers

```typescript
import { PubSub } from "@google-cloud/pubsub";
import { createTypedPubsub } from "typed-pubsub";
import { z } from "zod";

// 1. Define your schemas
const schemas = {
  user_created: z.object({
    userId: z.string(),
    email: z.string().email(),
  }),
};

// 2. Create PubSub client
const pubsubClient = new PubSub();

// 3. Initialize typed PubSub
const pubsub = createTypedPubsub({
  pubsubClient,
  schemas,
  region: "us-central1",
});

// 4a. Create and use a publisher
await pubsub.createPublisher("user_created")({
  userId: "123",
  email: "user@example.com",
});

// 4b. Create a handler
export const handle_user_created = pubsub.createHandler({
  topic: "user_created",
  handler: async (data) => {
    // data is fully typed based on the schema
    console.log(`New user created: ${data.email}`);
  },
});
```



## Usage Examples

### Basic Setup

```typescript
import { PubSub } from "@google-cloud/pubsub";
import { createTypedPubsub } from "typed-pubsub";
import { z } from "zod";

// Define your schemas
const schemas = {
  user_created: z.object({
    userId: z.string(),
    email: z.string().email(),
    createdAt: z.string().datetime(),
  }),
  order_placed: z.object({
    orderId: z.string(),
    userId: z.string(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })
    ),
    total: z.number().positive(),
  }),
};

// Create a PubSub client
const pubsubClient = new PubSub();

// Create typed Pubsub client
const pubsub = createTypedPubsub({
  pubsubClient,
  schemas,
  region: "us-central1",
});

// Publish a message
await pubsub.createPublisher("user_created")({
  userId: "123",
  email: "user@example.com",
  createdAt: new Date().toISOString(),
});

// Create a handler
export const handle_order_placed = pubsub.createHandler({
  topic: "order_placed",
  handler: async (data) => {
    // data is fully typed based on the schema
    console.log(`Processing order ${data.orderId} for user ${data.userId}`);
    // Process the order...
  },
  options: {
    memory: "1GiB",
    timeoutSeconds: 60,
    markEvent: true, // Never process this event more than once
  },
});
```

> **Note:** The examples use snake_case for topic names (like "user_created")
> and exported cloud functions (like handle_order_placed). This is because
> casing is currently ignored in Cloud Run function names in GCP, so using
> snake_case is preferred for consistency.

### Preventing Duplicate Processing with Event Marking

PubSub has at-least-once delivery semantics, meaning messages might occasionally
be delivered more than once. For operations that must be executed exactly once
(like payment processing or user credit awards), this library provides event
marking.

The `markEvent` option uses your provided storage (like Redis) to track which
event IDs have already been processed, ensuring each event is handled exactly
once despite potential redeliveries.

```typescript
import { PubSub } from "@google-cloud/pubsub";
import { createTypedPubsub } from "typed-pubsub";
import { redis } from "./redis-client";

// Create event marking functions
const eventMarkingFunctions = {
  isEventProcessed: async (eventId) => {
    return Boolean(await redis.get(`event:${eventId}`));
  },
  markEventAsProcessed: async (eventId) => {
    await redis.set(`event:${eventId}`, "1", "EX", 86400); // 24 hours TTL
  },
};

// Create typed Pubsub client with event marking
const pubsub = createTypedPubsub({
  pubsubClient,
  schemas,
  region: "us-central1",
  options: {
    eventMarkingFunctions,
    defaultHandlerOptions: {
      markEvent: true, // Enable for all handlers by default
      vpcConnector: "redis-connector", // If Redis is in a VPC
    },
  },
});
```

### Handling Time-Sensitive Events

For time-sensitive operations, you may want to discard messages that are too
old. The `retryMaxAgeMinutes` option automatically drops events that exceed the
specified age, preventing the processing of stale data.

```typescript
// Configure time-based message dropping in the handler
export const handle_time_sensitive_events = pubsub.createHandler({
  topic: "time_sensitive_events",
  handler: async (data) => {
    // Process time-sensitive event
  },
  options: {
    retryMaxAgeMinutes: 60, // Only process events less than 1 hour old
  },
});
```

## API Reference

### `createTypedPubsub(options)`

Creates a type-safe Pubsub client for handling messages with schema validation.

#### Parameters

- `options`: Configuration object with the following properties:
  - `pubsubClient`: Google Cloud Pubsub client instance
  - `schemas`: Record of Zod schemas for each topic
  - `region`: GCP region for the Pubsub functions
  - `options`: (Optional) Configuration options
    - `eventMarkingFunctions`: (Optional) Functions for tracking processed
      events
    - `defaultHandlerOptions`: (Optional) Default options for all handlers
  - `onMessagePublished`: (Optional) Firebase message published handler,
    defaults to firebase implementation

### Key Handler Options

| Option               | Description                       | Default                |
| -------------------- | --------------------------------- | ---------------------- |
| `retry`              | Enable/disable automatic retries  | `true`                 |
| `retryMaxAgeMinutes` | Maximum event age before dropping | `undefined` (no limit) |
| `memory`             | Memory allocation                 | `"512MiB"`             |
| `markEvent`          | Enable duplicate prevention       | `false`                |
| `timeoutSeconds`     | Function timeout in seconds       | `20`                   |
| `maxInstances`       | Maximum concurrent instances      | `250`                  |
| `vpcConnector`       | Name of the VPC connector         | `undefined`            |

**Important note about retry behavior**: While you can enable/disable retries
and set maximum age for retried events, the actual retry timing is controlled by
the PubSub subscription's ACK deadline, not by the `timeoutSeconds` setting. The
timeout will shut down the server process, but the event will only be retried
after the ACK deadline expires, which cannot be configured through this library.

## Limitations and Alternatives

While this library provides excellent type safety and schema validation for
PubSub messages, there are some limitations inherent to PubSub:

- Limited control over retry timing (controlled by subscription ACK deadline)
- No built-in support for manually triggered retries
- No fine-grained error handling for different failure scenarios

If your use case requires more advanced features like controlled retry
intervals, manual retry triggering, or long-running background processes,
consider using a dedicated task queue system. The
[github.com/0x80/typed-tasks](https://github.com/0x80/typed-tasks) library
provides similar type-safety guarantees with more control over task execution.
