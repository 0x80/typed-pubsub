import type { PubSub } from "@google-cloud/pubsub";
import { onMessagePublished as firebaseOnMessagePublished } from "firebase-functions/v2/pubsub";
import { defaultHandlerOptions } from "./constants";
import { createHandlerFactory } from "./handler";
import { createPublisherFactory } from "./publisher";
import type {
  HandlerOptions,
  SchemaRecord,
  TypedPubsubClient,
  TypedPubsubOptions,
} from "./types";

/**
 * Creates a type-safe Pubsub client for handling messages with schema
 * validation
 *
 * @param pubsubClient - Google Cloud Pubsub client instance
 * @param schemas - Zod schemas for validating messages for each topic
 * @param region - GCP region for the Pubsub functions
 * @param options - Global defaults for all handlers
 * @returns Type-safe Pubsub client with publisher and handler factories
 */
export function createTypedPubsub<Schemas extends SchemaRecord<string>>({
  client,
  schemas,
  region,
  options = {},
  onMessagePublished = firebaseOnMessagePublished,
}: {
  client: PubSub;
  schemas: Schemas;
  region: string;
  options?: TypedPubsubOptions;
  onMessagePublished?: typeof firebaseOnMessagePublished;
}): TypedPubsubClient<Schemas> {
  // Merge default handler options
  const handlerOptions: HandlerOptions = {
    ...defaultHandlerOptions,
    ...options.defaultHandlerOptions,
  };

  return {
    createPublisher: createPublisherFactory<Schemas>(client),
    createHandler: createHandlerFactory(
      schemas,
      region,
      options.eventMarkingFunctions,
      handlerOptions,
      onMessagePublished,
    ),
  };
}
