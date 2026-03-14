# Getting Started

## Installation

```bash
npm install @codecompose/typed-pubsub
```

## Peer Dependencies

This package requires the following peer dependencies:

- `@google-cloud/pubsub` (>= 4)
- `firebase-functions` (>= 6)
- `zod` (>= 3)

Install them if you haven't already:

```bash
npm install @google-cloud/pubsub firebase-functions zod
```

## Basic Setup

### 1. Define your schemas

Create a file to define your PubSub topic schemas using Zod. Each key becomes a topic name, and its value defines the expected message payload.

```typescript
// pubsub.ts
import { PubSub } from "@google-cloud/pubsub";
import { createTypedPubsub } from "@codecompose/typed-pubsub";
import { z } from "zod";

const schemas = {
  user_created: z.object({
    userId: z.string(),
    email: z.string().email(),
  }),
  order_placed: z.object({
    orderId: z.string(),
    userId: z.string(),
    total: z.number().positive(),
  }),
} as const;

export const pubsub = createTypedPubsub({
  client: new PubSub(),
  schemas,
  region: "us-central1",
});
```

### 2. Create a publisher

Use `createPublisher` to publish type-safe messages. The topic name is autocompleted, and the payload is validated against the schema at compile time.

```typescript
import { pubsub } from "./pubsub";

export async function onUserSignup(userId: string, email: string) {
  await pubsub.createPublisher("user_created")({ userId, email });
}
```

### 3. Create a handler

Use `createHandler` to create a Firebase Cloud Function that processes messages from a topic. The handler receives a fully typed payload.

```typescript
import { pubsub } from "./pubsub";

export const handle_user_created = pubsub.createHandler({
  topic: "user_created",
  handler: async (data) => {
    // data.userId and data.email are fully typed
    console.log(`New user created: ${data.email}`);
  },
});
```

::: tip Snake case convention
The examples use snake_case for topic names and exported cloud functions. This is because casing is currently ignored in Cloud Run function names in GCP, so snake_case is preferred for consistency.
:::

### 4. Export as Cloud Functions

Export handlers from your functions entry point so Firebase deploys them:

```typescript
// index.ts
export { handle_user_created } from "./handlers/user-created";
export { handle_order_placed } from "./handlers/order-placed";
```

## Next Steps

- [Configuration](/configuration) — Customize default options and per-handler overrides
- [Event Marking](/event-marking) — Prevent duplicate processing with Redis
- [Stale Events](/stale-events) — Drop old messages during retry storms
