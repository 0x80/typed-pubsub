import { onMessagePublished as firebaseOnMessagePublished } from "firebase-functions/v2/pubsub";
import { got } from "get-or-throw";
import { defaultHandlerOptions } from "./constants";
import type {
  EventMarkingFunctions,
  HandlerOptions,
  PubsubTopicPayload,
  SchemaRecord,
} from "./types";
import { shouldDropEvent } from "./utils";

/**
 * Creates a factory function for generating type-safe Pubsub handlers
 *
 * @param schemas - Zod schemas for each topic
 * @param region - GCP region
 * @param eventMarkingFunctions - Optional functions for tracking processed
 *   events
 * @param defaultOptions - Default options for all handlers
 * @returns A factory function for creating handlers
 */
export function createHandlerFactory<Schemas extends SchemaRecord<string>>(
  schemas: Schemas,
  region: string,
  eventMarkingFunctions?: EventMarkingFunctions,
  defaultOptions: HandlerOptions = defaultHandlerOptions,
  onMessagePublished = firebaseOnMessagePublished
) {
  return <T extends keyof Schemas & string>({
    topic,
    handler,
    options = {},
  }: {
    topic: T;
    handler: (payload: PubsubTopicPayload<Schemas, T>) => Promise<void>;
    options?: HandlerOptions;
  }) => {
    const {
      retryMaxAgeMinutes,
      memory,
      timeoutSeconds,
      markEvent,
      vpcConnector,
      retry,
    } = {
      ...defaultOptions,
      ...options,
    };

    // Determine if we can mark events
    const canMarkEvents = markEvent && eventMarkingFunctions !== undefined;

    return onMessagePublished(
      {
        topic,
        region,
        retry,
        vpcConnector,
        cpu: 1,
        memory,
        timeoutSeconds,
      },
      async (event) => {
        // Use internal shouldDropEvent implementation
        if (shouldDropEvent(event, retryMaxAgeMinutes)) {
          return;
        }

        // Check if event was already processed, but only if both conditions are met:
        // 1. markEvent option is true
        // 2. Event marking functions are available
        if (canMarkEvents && event.id) {
          if (await eventMarkingFunctions.isEventProcessed(event.id)) {
            /**
             * This should happen very rarely, so we log an error just to notice
             * how often it happens.
             */
            console.error(
              new Error(
                `(Not an error) Pubsub event ${event.id} was already processed`
              )
            );
            return;
          }
        }

        const schema = got(schemas, topic);
        // Type assertion to avoid unsafe assignment
        const messageData = event.data.message.json as unknown;
        const result = schema.safeParse(messageData);

        if (!result.success) {
          console.error(
            new Error(`Zod validation error for topic ${topic}`),
            result.error.flatten()
          );
          return;
        }

        await handler(result.data as PubsubTopicPayload<Schemas, T>);

        // Mark event as processed, but only if both conditions are met
        if (canMarkEvents && event.id) {
          await eventMarkingFunctions.markEventAsProcessed(event.id);
        }
      }
    );
  };
}
