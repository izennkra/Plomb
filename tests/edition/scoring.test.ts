import { describe, expect, it } from "vitest";
import { importanceOf, type Criteria } from "@/modules/edition/scoring";

const all = (value: number): Criteria => ({ notoriety: value, scale: value, authors: value, reach: value, quality: value });

describe("importanceOf", () => {
  it("goes from 1 (all criteria at 1) to 10 (all at 5)", () => {
    expect(importanceOf(all(1))).toBe(1);
    expect(importanceOf(all(5))).toBe(10);
    expect(importanceOf(all(3))).toBe(5.5);
  });

  it("a Coca-Cola rebrand beats a beautiful local café rebrand", () => {
    const cocaCola = { notoriety: 5, scale: 5, authors: 4, reach: 5, quality: 3 };
    const matchaCafe = { notoriety: 1, scale: 2, authors: 2, reach: 1, quality: 5 };
    expect(importanceOf(cocaCola)).toBeGreaterThan(8.5);
    expect(importanceOf(matchaCafe)).toBeLessThan(4);
  });

  it("notoriety weighs more than quality", () => {
    expect(importanceOf({ ...all(3), notoriety: 5 })).toBeGreaterThan(importanceOf({ ...all(3), quality: 5 }));
  });

  it("other media covering the subject add up to 2 points, never above 10", () => {
    expect(importanceOf(all(3), 1)).toBe(6.5);
    expect(importanceOf(all(3), 5)).toBe(7.5);
    expect(importanceOf(all(5), 2)).toBe(10);
  });

  it("ignores out-of-range notes", () => {
    expect(importanceOf({ ...all(3), notoriety: 9 })).toBe(importanceOf({ ...all(3), notoriety: 5 }));
  });
});
