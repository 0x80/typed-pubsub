import type { PubSubOptions } from "firebase-functions/v2/pubsub";
import type { z } from "zod";

/** Type definition for a pubsub handler function returned by createHandler */
export type PubsubHandlerFunction = ReturnType<
  typeof import("firebase-functions/v2/pubsub").onMessagePublished
>;

/** Type representing valid pubsub topic names */
export type PubsubTopic = string;

/** Record of schema types for each topic */
export type SchemaRecord<TopicName extends PubsubTopic> = Record<
  TopicName,
  z.ZodType
>;

/**
 * Type to extract the payload type for a given PubSub topic using the schema's
 * type definition
 */
export type PubsubTopicPayload<
  Schemas extends SchemaRecord<string>,
  T extends keyof Schemas & string,
> = z.infer<Schemas[T]>;

/** Event marking functions used for tracking processed events */
export type EventMarkingFunctions = {
  /** Checks if an event has already been processed */
  isEventProcessed: (eventId: string) => Promise<boolean>;

  /** Marks an event as processed */
  markEventAsProcessed: (eventId: string) => Promise<void>;
};

/** Options for configuring the typed Pubsub client */
export type TypedPubsubOptions = {
  /** Optional event marking functions */
  eventMarkingFunctions?: EventMarkingFunctions;
  /** Default options for all handlers */
  defaultHandlerOptions?: HandlerOptions;
};

/** Helper type for tuple creation to track recursion depth */
export type LengthTuple<
  N extends number,
  T extends unknown[] = [],
> = T["length"] extends N ? T : LengthTuple<N, [...T, unknown]>;

/** Type definition for a typed Pubsub client */
export type TypedPubsubClient<Schemas extends SchemaRecord<string>> = {
  /** Creates a type-safe publisher function for the specified topic */
  createPublisher: <T extends keyof Schemas & string>(
    topic: T,
  ) => (data: PubsubTopicPayload<Schemas, T>) => Promise<void>;

  /** Creates a type-safe handler function for processing messages from a topic */
  createHandler: <T extends keyof Schemas & string>(options: {
    topic: T;
    handler: (payload: PubsubTopicPayload<Schemas, T>) => Promise<void>;
    options?: HandlerOptions;
  }) => PubsubHandlerFunction;
};

/** Options for configuring a Pubsub message handler */
export type HandlerOptions = Omit<PubSubOptions, "region" | "topic"> & {
  /** Whether to enable retries (true) or disable retries (false) */
  retry?: boolean;

  /** Maximum age of an event in minutes before it will be dropped */
  retryMaxAgeMinutes?: number;

  /** Whether to mark events as processed to prevent duplicates */
  markEvent?: boolean;
};
