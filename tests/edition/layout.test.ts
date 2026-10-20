import { describe, expect, it } from "vitest";
import { imageRatio, windowSlots } from "@/modules/edition/layout";

describe("journal grid", () => {
  it("puts the main secondary article large on the right, then follows the reference's rhythm", () => {
    expect(windowSlots(6)).toEqual([
      { column: 4, span: 9 },
      { column: 1, span: 3 },
      { column: 4, span: 3 },
      { column: 7, span: 6 },
      { column: 1, span: 6 },
      { column: 7, span: 3 },
    ]);
  });

  it("every window stays inside the 12 columns, however many articles", () => {
    for (const slot of windowSlots(40)) expect(slot.column + slot.span - 1).toBeLessThanOrEqual(12);
  });

  it("narrow windows get tall pictures, large ones wide pictures", () => {
    expect(imageRatio(3)).toBe("3 / 4");
    expect(imageRatio(9)).toBe("16 / 9");
  });
});
