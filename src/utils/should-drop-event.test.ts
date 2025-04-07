import type { CloudEvent } from "firebase-functions/v2";
import { describe, expect, it, vi } from "vitest";
import { HOUR_MINUTES, MINUTE_MS } from "../constants";
import { shouldDropEvent } from "./should-drop-event";

describe("event-utils", () => {
  describe("shouldDropEvent", () => {
    it("Should return false if event has no time property", () => {
      const event = {} as CloudEvent<unknown>;
      expect(shouldDropEvent(event, 60)).toBe(false);
    });

    it("Should return false if event is within max age", () => {
      const now = Date.now();
      /** Complete CloudEvent with recent timestamp */
      const event: CloudEvent<unknown> = {
        id: "event-id",
        source: "test-source",
        type: "test-type",
        specversion: "1.0" as const,
        time: new Date(now - 30 * MINUTE_MS).toISOString(),
        data: {},
      };
      expect(shouldDropEvent(event, 60)).toBe(false);
    });

    it("Should return true if event is older than max age", () => {
      /** Temporarily silence console.error during test */
      const originalConsoleError = console.error;
      console.error = vi.fn();

      try {
        const now = Date.now();
        /** Complete CloudEvent with old timestamp */
        const event: CloudEvent<unknown> = {
          id: "event-id",
          source: "test-source",
          type: "test-type",
          specversion: "1.0" as const,
          time: new Date(now - 2 * HOUR_MINUTES * MINUTE_MS).toISOString(),
          data: {},
        };
        expect(shouldDropEvent(event, HOUR_MINUTES)).toBe(true);
      } finally {
        /** Restore original console.error */
        console.error = originalConsoleError;
      }
    });
  });

  describe("constants", () => {
    it("Should define correct values", () => {
      expect(HOUR_MINUTES).toBe(60);
      expect(MINUTE_MS).toBe(60 * 1000);
    });
  });
});
