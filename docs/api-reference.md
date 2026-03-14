# API Reference

## createTypedPubsub

Creates a type-safe PubSub client for handling messages with schema validation.

```typescript
function createTypedPubsub<Schemas extends SchemaRecord<string>>(options: {
  client: PubSub;
  schemas: Schemas;
  region: string;
  options?: TypedPubsubOptions;
  onMessagePublished?: typeof firebaseOnMessagePublished;
}): TypedPubsubClient<Schemas>;
```

Returns an object with `createPublisher` and `createHandler` methods.

## createPublisher

Creates a type-safe publisher function for a specific topic. The returned function publishes a JSON message to the topic via the Google Cloud PubSub client.

```typescript
const publish = pubsub.createPublisher("user_created");

await publish({ userId: "123", email: "user@example.com" });
```

The topic name is constrained to keys of your schema record, and the payload is typed according to the corresponding Zod schema.

## createHandler

Creates a Firebase Cloud Function handler for processing messages from a PubSub topic. The handler validates incoming messages against the Zod schema before invoking your callback.

```typescript
const handler = pubsub.createHandler({
  topic: "user_created",
  handler: async (data) => {
    // data is typed as { userId: string; email: string }
  },
  options: {
    memory: "1GiB",
    timeoutSeconds: 60,
  },
});
```

The processing pipeline is:

1. Check if the event should be dropped (stale event handling)
2. Check if the event was already processed (event marking)
3. Validate the message payload against the Zod schema
4. Invoke the handler with the typed payload
5. Mark the event as processed (if event marking is enabled)

If Zod validation fails, the error is logged and the message is acknowledged (not retried), since the payload shape will not change on retry.

## Types

### PubsubTopicPayload

Extract the typed payload for a specific topic from your schema record:

```typescript
type PubsubTopicPayload<
  Schemas extends SchemaRecord<string>,
  T extends keyof Schemas & string,
> = z.infer<Schemas[T]>;
```

Useful when you need to reference a topic's payload type outside of a handler:

```typescript
import type { PubsubTopicPayload } from "@codecompose/typed-pubsub";

type UserCreatedPayload = PubsubTopicPayload<typeof schemas, "user_created">;
// { userId: string; email: string }
```

### EventMarkingFunctions

Interface for the storage functions used by event marking:

```typescript
type EventMarkingFunctions = {
  isEventProcessed: (eventId: string) => Promise<boolean>;
  markEventAsProcessed: (eventId: string) => Promise<void>;
};
```

### HandlerOptions

Options for configuring a handler. Extends `PubSubOptions` from `firebase-functions/v2/pubsub` (excluding `region` and `topic`) with additional properties:

| Property             | Type      | Description                       |
| -------------------- | --------- | --------------------------------- |
| `retry`              | `boolean` | Enable/disable automatic retries  |
| `retryMaxAgeMinutes` | `number`  | Maximum event age before dropping |
| `markEvent`          | `boolean` | Enable duplicate prevention       |

All other `PubSubOptions` properties (like `memory`, `cpu`, `timeoutSeconds`, `maxInstances`, `vpcConnector`, etc.) are also available.

### SchemaRecord

Record of Zod schemas keyed by topic name:

```typescript
type SchemaRecord<TopicName extends string> = Record<TopicName, z.ZodType>;
```

## Constants

### HOUR_MINUTES

```typescript
export const HOUR_MINUTES = 60;
```

### MINUTE_MS

```typescript
export const MINUTE_MS = 60 * 1000;
```

### defaultHandlerOptions

The built-in default values for handler options:

```typescript
export const defaultHandlerOptions = {
  retry: true,
  retryMaxAgeMinutes: undefined,
  memory: "512MiB",
  cpu: 1,
  timeoutSeconds: 20,
  maxInstances: 250,
  markEvent: false,
  vpcConnector: undefined,
};
```
