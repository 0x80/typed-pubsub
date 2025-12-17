import { PubSub } from "@google-cloud/pubsub";
import type { PubsubTopicPayload, SchemaRecord } from "./types";

/**
 * Creates a factory function that produces type-safe publishers for specific
 * topics
 *
 * @param pubsubClient - Google Cloud Pubsub client
 * @returns A factory function for creating publishers
 */
export function createPublisherFactory<Schemas extends SchemaRecord<string>>(
  pubsubClient: PubSub,
) {
  return <T extends keyof Schemas & string>(topicName: T) => {
    /**
     * Publishes a message to the specified topic
     *
     * @param data - The data to publish, must conform to the topic's schema
     * @returns Promise that resolves when the message is published
     */
    return async (data: PubsubTopicPayload<Schemas, T>) => {
      const topic = pubsubClient.topic(topicName);
      await topic.publishMessage({ json: data });
    };
  };
}
