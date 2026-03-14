# Configuration

## createTypedPubsub Options

The `createTypedPubsub` factory accepts the following parameters:

```typescript
const pubsub = createTypedPubsub({
  client: new PubSub(),
  schemas,
  region: "us-central1",
  options: {
    eventMarkingFunctions: { ... },
    defaultHandlerOptions: { ... },
  },
});
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `client` | `PubSub` | Yes | Google Cloud PubSub client instance |
| `schemas` | `SchemaRecord` | Yes | Record of Zod schemas keyed by topic name |
| `region` | `string` | Yes | GCP region for the PubSub functions |
| `options` | `TypedPubsubOptions` | No | Global configuration |
| `onMessagePublished` | `function` | No | Custom message handler (defaults to Firebase implementation) |

### TypedPubsubOptions

| Property | Type | Description |
| --- | --- | --- |
| `eventMarkingFunctions` | `EventMarkingFunctions` | Functions for tracking processed events. See [Event Marking](/event-marking) |
| `defaultHandlerOptions` | `HandlerOptions` | Default options applied to all handlers |

## Handler Options

Handler options can be set at two levels:

1. **Global defaults** via `options.defaultHandlerOptions` in `createTypedPubsub`
2. **Per-handler overrides** via the `options` property in `createHandler`

Per-handler options are merged on top of the global defaults.

```typescript
// Global defaults
const pubsub = createTypedPubsub({
  client: new PubSub(),
  schemas,
  region: "us-central1",
  options: {
    defaultHandlerOptions: {
      memory: "1GiB",
      timeoutSeconds: 60,
    },
  },
});

// Per-handler override
export const handle_heavy_task = pubsub.createHandler({
  topic: "heavy_task",
  handler: async (data) => { ... },
  options: {
    memory: "2GiB",        // Override the global default
    timeoutSeconds: 300,   // Override the global default
    markEvent: true,       // Not set globally, added here
  },
});
```

### Default Values

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `retry` | `boolean` | `true` | Enable automatic retries with exponential backoff |
| `retryMaxAgeMinutes` | `number` | `undefined` | Maximum event age before dropping. See [Stale Events](/stale-events) |
| `memory` | `string` | `"512MiB"` | Memory allocation per instance |
| `cpu` | `number` | `1` | CPU allocation per instance |
| `timeoutSeconds` | `number` | `20` | Function timeout in seconds |
| `maxInstances` | `number` | `250` | Maximum concurrent instances |
| `markEvent` | `boolean` | `false` | Enable duplicate prevention. See [Event Marking](/event-marking) |
| `vpcConnector` | `string` | `undefined` | VPC connector name (needed for Redis in a VPC) |

In addition to these options, all native `PubSubOptions` from `firebase-functions/v2/pubsub` (except `region` and `topic`) are supported and forwarded directly to the underlying Firebase function.

::: warning Retry timing
While you can enable/disable retries and set a maximum age for retried events, the actual retry timing is controlled by the PubSub subscription's ACK deadline, not by the `timeoutSeconds` setting. The timeout will shut down the server process, but the event will only be retried after the ACK deadline expires.
:::
