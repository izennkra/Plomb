import { describe, expect, it } from "vitest";
import { groupEchoes, sameSubject, subjectKey } from "@/modules/edition/echo";

describe("subjectKey", () => {
  it("normalises names", () => {
    expect(subjectKey("The Coca-Cola Company")).toBe("coca cola");
    expect(subjectKey("Musée d'Orsay")).toBe("musee d orsay");
  });

  it("ignores subjects too short or too vague to group on", () => {
    expect(subjectKey("")).toBeNull();
    expect(subjectKey("IA")).toBeNull();
    expect(subjectKey("Identité visuelle")).toBeNull();
  });
});

describe("sameSubject", () => {
  it("recognises the same brand written differently", () => {
    expect(sameSubject("coca cola", "coca cola")).toBe(true);
    expect(sameSubject("coca cola", "coca cola zero")).toBe(true);
  });

  it("does not confuse different subjects", () => {
    expect(sameSubject("nike", "nike free practice")).toBe(false); // too short to be sure
    expect(sameSubject("moma", "moma ps1")).toBe(false);
    expect(sameSubject("coca cola", "pepsi")).toBe(false);
  });
});

describe("groupEchoes", () => {
  const story = (title: string, subject: string, source: string, score: number) => ({ item: { title, score }, subject, source });
  const better = (a: { score: number }, b: { score: number }) => a.score > b.score;

  it("one story covered by 3 media → one article (the best), the others named", () => {
    const groups = groupEchoes(
      [
        story("BN Coca-Cola", "Coca-Cola", "brandnew", 8),
        story("TBI Coca-Cola", "The Coca-Cola Company", "the-brandidentity.com", 9),
        story("Matcha", "Matchalita", "the-brandidentity.com", 4),
        story("INT Coca-Cola", "Coca Cola", "itsnicethat.com", 7),
      ],
      better,
    );
    expect(groups).toEqual([
      { item: { title: "TBI Coca-Cola", score: 9 }, coveredBy: ["brandnew", "itsnicethat.com"] },
      { item: { title: "Matcha", score: 4 }, coveredBy: [] },
    ]);
  });

  it("never merges two articles of the same source, nor vague subjects", () => {
    const groups = groupEchoes(
      [
        story("TBI 1", "Coca-Cola", "the-brandidentity.com", 5),
        story("TBI 2", "Coca-Cola", "the-brandidentity.com", 6),
        story("A", "Design", "a.com", 5),
        story("B", "Design", "b.com", 5),
      ],
      better,
    );
    expect(groups).toHaveLength(4);
  });
});
