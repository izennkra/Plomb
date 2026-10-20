import { describe, expect, it } from "vitest";
import { mapInParallel } from "@/modules/edition/parallel";

describe("mapInParallel", () => {
  it("keeps the order and never runs more than the limit at once", async () => {
    let running = 0;
    let maxRunning = 0;
    const results = await mapInParallel([5, 1, 4, 2, 3], 2, async (value) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, value * 3));
      running--;
      return value * 10;
    });
    expect(results).toEqual([50, 10, 40, 20, 30]);
    expect(maxRunning).toBe(2);
  });

  it("handles an empty list", async () => {
    expect(await mapInParallel([], 4, async (value) => value)).toEqual([]);
  });
});
