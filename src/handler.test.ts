/** Mocks must be defined before any imports */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import the type we need to mock, without importing the actual function
import type { CloudEvent } from "firebase-functions/v2";
import type {
  MessagePublishedData,
  onMessagePublished as onMessagePublishedType,
} from "firebase-functions/v2/pubsub";

// Create simple mock functions with type assertion to match Firebase's function signature
const onMessagePublishedMock = vi
  .fn()
  .mockImplementation(
    (
      config,
      handlerFn: (event: CloudEvent<MessagePublishedData>) => Promise<void>,
    ) => {
      // Return a function that simulates the handler function being called
      // This lets us call the handler directly in tests without the real Firebase function
      return handlerFn;
    },
  ) as unknown as typeof onMessagePublishedType;

vi.mock("./utils", () => ({
  shouldDropEvent: vi.fn().mockReturnValue(false),
}));

// Regular imports after mock definitions
import { z } from "zod";
import { HOUR_MINUTES } from "./constants";
import { createHandlerFactory } from "./handler";
import type { HandlerOptions } from "./types";
import { shouldDropEvent } from "./utils";

/** Define a common type for our test events */
const createMockEvent = (data: Record<string, unknown>) => ({
  id: "event-123",
  data: {
    message: {
      json: data,
    },
  },
  publishTime: new Date().toISOString(),
  specversion: "1.0" as const,
  source: "test",
  type: "test.event",
  time: new Date().toISOString(),
});

describe("createHandlerFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Test schemas */
  const testSchemas = {
    test: z.object({
      name: z.string(),
    }),
    alert: z.object({
      level: z.enum(["info", "warning", "error"]),
      message: z.string(),
    }),
  } as const;

  /** Test region */
  const region = "us-central1";

  /** Test default options */
  const handlerOptions: HandlerOptions = {
    retry: true,
    retryMaxAgeMinutes: 48 * HOUR_MINUTES,
    memory: "512MiB",
    markEvent: false,
    timeoutSeconds: 20,
    vpcConnector: undefined,
    maxInstances: 250,
  };

  /** Custom event marking functions for testing */
  const eventMarkingFunctions = {
    isEventProcessed: vi.fn().mockResolvedValue(false),
    markEventAsProcessed: vi.fn().mockResolvedValue(undefined),
  };

  it("should create a handler with the correct configuration", () => {
    const createHandler = createHandlerFactory(
      testSchemas,
      region,
      undefined,
      handlerOptions,
      onMessagePublishedMock,
    );

    const handlerFn = vi.fn().mockResolvedValue(undefined);
    createHandler({
      topic: "test",
      handler: handlerFn,
    });

    // Verify onMessagePublished was called with correct config
    expect(onMessagePublishedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "test",
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 20,
        vpcConnector: undefined,
        maxInstances: 250,
      }),
      expect.any(Function),
    );
  });

  it("should forward additional PubSub options via spread", () => {
    const createHandler = createHandlerFactory(
      testSchemas,
      region,
      undefined,
      handlerOptions,
      onMessagePublishedMock,
    );

    const handlerFn = vi.fn().mockResolvedValue(undefined);
    createHandler({
      topic: "alert",
      handler: handlerFn,
      options: {
        cpu: 2,
        maxInstances: 100,
      },
    });

    /** Verify spread-forwarded options are passed through to onMessagePublished */
    expect(onMessagePublishedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "alert",
        region: "us-central1",
        cpu: 2,
        maxInstances: 100,
      }),
      expect.any(Function),
    );
  });

  it("should call the handler with valid event data", async () => {
    const createHandler = createHandlerFactory(
      testSchemas,
      region,
      undefined,
      handlerOptions,
      onMessagePublishedMock,
    );

    const handlerFn = vi.fn().mockResolvedValue(undefined);
    const handler = createHandler({
      topic: "test",
      handler: handlerFn,
    });

    // Create a mock event with valid data
    const mockEvent = createMockEvent({ name: "test-event" });

    // Call the handler directly - this works because our mock returns the handler function
    await handler(mockEvent);

    // Verify handler was called with the correct payload
    expect(handlerFn).toHaveBeenCalledWith({ name: "test-event" });
  });

  it("should not call the handler with invalid event data", async () => {
    /** Temporarily silence console.error during test */
    const originalConsoleError = console.error;
    console.error = vi.fn();

    try {
      const createHandler = createHandlerFactory(
        testSchemas,
        region,
        undefined,
        handlerOptions,
        onMessagePublishedMock,
      );

      const handlerFn = vi.fn().mockResolvedValue(undefined);
      const handler = createHandler({
        topic: "test",
        handler: handlerFn,
      });

      /** Create a mock event with invalid data (missing required field) */
      const mockEvent = createMockEvent({ invalid: "data" });

      /** Call the handler with invalid data - it should not throw */
      await handler(mockEvent);

      /** Verify handler was NOT called due to validation failure */
      expect(handlerFn).not.toHaveBeenCalled();
    } finally {
      /** Restore original console.error */
      console.error = originalConsoleError;
    }
  });

  it("should skip processing when event should be dropped", async () => {
    // Mock shouldDropEvent to return true for this test
    (
      shouldDropEvent as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValueOnce(true);

    const createHandler = createHandlerFactory(
      testSchemas,
      region,
      undefined,
      handlerOptions,
      onMessagePublishedMock,
    );

    const handlerFn = vi.fn().mockResolvedValue(undefined);
    const handler = createHandler({
      topic: "test",
      handler: handlerFn,
    });

    // Create a mock event
    const mockEvent = createMockEvent({ name: "test-event" });

    // Call the handler directly
    await handler(mockEvent);

    // Verify shouldDropEvent was called
    expect(shouldDropEvent).toHaveBeenCalledWith(
      mockEvent,
      handlerOptions.retryMaxAgeMinutes,
    );

    // Verify handler was NOT called because event should be dropped
    expect(handlerFn).not.toHaveBeenCalled();
  });

  it("should use event marking when configured", async () => {
    const createHandler = createHandlerFactory(
      testSchemas,
      region,
      eventMarkingFunctions,
      handlerOptions,
      onMessagePublishedMock,
    );

    const handlerFn = vi.fn().mockResolvedValue(undefined);
    const handler = createHandler({
      topic: "test",
      handler: handlerFn,
      options: {
        markEvent: true,
      },
    });

    // Create a mock event
    const mockEvent = createMockEvent({ name: "test-event" });

    // Call the handler directly
    await handler(mockEvent);

    // Verify event marking functions were called
    expect(eventMarkingFunctions.isEventProcessed).toHaveBeenCalledWith(
      "event-123",
    );
    expect(eventMarkingFunctions.markEventAsProcessed).toHaveBeenCalledWith(
      "event-123",
    );

    // Verify handler was called with the correct payload
    expect(handlerFn).toHaveBeenCalledWith({ name: "test-event" });
  });

  it("should skip already processed events", async () => {
    /** Temporarily silence console.error during test */
    const originalConsoleError = console.error;
    console.error = vi.fn();

    try {
      /** Override the mock to simulate an already processed event */
      eventMarkingFunctions.isEventProcessed.mockResolvedValueOnce(true);

      const createHandler = createHandlerFactory(
        testSchemas,
        region,
        eventMarkingFunctions,
        handlerOptions,
        onMessagePublishedMock,
      );

      const handlerFn = vi.fn().mockResolvedValue(undefined);
      const handler = createHandler({
        topic: "test",
        handler: handlerFn,
        options: {
          markEvent: true,
        },
      });

      /** Create a mock event */
      const mockEvent = createMockEvent({ name: "test-event" });

      /** Call the handler with an already processed event - it should not throw */
      await handler(mockEvent);

      /** Verify isEventProcessed was called */
      expect(eventMarkingFunctions.isEventProcessed).toHaveBeenCalledWith(
        "event-123",
      );

      /** Verify handler was NOT called as the event was already processed */
      expect(handlerFn).not.toHaveBeenCalled();

      /** Verify markEventAsProcessed was NOT called again */
      expect(eventMarkingFunctions.markEventAsProcessed).not.toHaveBeenCalled();
    } finally {
      /** Restore original console.error */
      console.error = originalConsoleError;
    }
  });
});
