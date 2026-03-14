# Real-World Examples

These patterns are drawn from production codebases using typed-pubsub.

## Cache Clearing Topics

A common pattern is using PubSub to trigger cache invalidation across services. Define lightweight schemas for cache-related events:

```typescript
const schemas = {
  clear_scorecard_cache: z.object({ reviewId: z.string() }),
  clear_memoize_cache: z.object({}),
  clear_all_scorecard_cache: z.object({}),
  calculate_part_progress: z.object({
    reviewId: z.string(),
    reference: z.string(),
  }),
} as const;

const pubsub = createTypedPubsub({
  client: new PubSub(),
  schemas,
  region: "europe-west1",
  options: {
    defaultHandlerOptions: {
      retryMaxAgeMinutes: 48 * HOUR_MINUTES,
      timeoutSeconds: 60,
    },
  },
});
```

Publishing a cache clear after a business operation:

```typescript
export async function resetReviewStructure(reviewId: string) {
  // ... business logic ...

  await pubsub.createPublisher("clear_scorecard_cache")({ reviewId });
}
```

## Complex Schemas with Discriminated Unions

For topics that carry different event types, use Zod discriminated unions to get precise typing based on the event type:

```typescript
const schemas = {
  record_user_event: z.discriminatedUnion("type", [
    z.object({
      userId: z.string(),
      type: z.literal("loadsRequest"),
      metadata: z.object({
        flightId: z.string(),
        isPriorityRequest: z.boolean(),
        noCharge: z.boolean().optional(),
      }),
    }),
    z.object({
      userId: z.string(),
      type: z.literal("purchase"),
      metadata: z.object({
        productId: z.string(),
        amount: z.number(),
      }),
    }),
    // ... more event types
  ]),
} as const;
```

## Handler Chaining

Handlers can publish messages to other topics, creating processing pipelines:

```typescript
export const notify_for_single_request = pubsub.createHandler({
  topic: "notify_for_single_request",
  options: {
    retry: false,
  },
  handler: async (payload) => {
    const { airlineId, flightId } = payload;

    const users = await findUsersToNotify(airlineId, flightId);

    // Publish to another topic from within a handler
    await pubsub.createPublisher("send_notifications")({
      userIdTokenPairs: users,
      type: "newLoadsRequest",
      notification: {
        title: "New loads available",
        body: `Flight ${flightId} has new loads`,
      },
      data: { airlineId, flightId },
    });
  },
});
```

## Event Recording with TTL

Record user events with an expiration time for automatic cleanup:

```typescript
export const record_user_event = pubsub.createHandler({
  topic: "record_user_event",
  handler: async ({ userId, type, metadata }) => {
    const ttlMs = YEAR_MS * 2;

    await refs.userEvents(userId).add({
      type,
      createdAt: FieldValue.serverTimestamp(),
      metadata,
      expireAt: Timestamp.fromMillis(Date.now() + ttlMs),
    });
  },
});
```

## Event Marking with Redis

For handlers where duplicate processing would cause real harm, enable event marking with a Redis-backed implementation:

```typescript
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });

const pubsub = createTypedPubsub({
  client: new PubSub(),
  schemas,
  region: "us-central1",
  options: {
    eventMarkingFunctions: {
      isEventProcessed: async (eventId) =>
        Boolean(await redis.get(`event:${eventId}`)),
      markEventAsProcessed: async (eventId) =>
        void (await redis.set(`event:${eventId}`, "1", { EX: 86400 })),
    },
    defaultHandlerOptions: {
      markEvent: true,
      vpcConnector: "redis-connector",
      retryMaxAgeMinutes: 48 * HOUR_MINUTES,
    },
  },
});
```
