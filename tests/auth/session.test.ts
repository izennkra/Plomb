import { describe, expect, it } from "vitest";
import { isPublicPath, isValidSession, sessionToken } from "@/modules/auth/session";

describe("session", () => {
  it("the cookie proves the password without containing it", async () => {
    const token = await sessionToken("mot-de-passe");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token).not.toContain("mot-de-passe");
    expect(await isValidSession(token, "mot-de-passe")).toBe(true);
  });

  it("a wrong or missing cookie is refused; changing the password signs everybody out", async () => {
    const token = await sessionToken("ancien");
    expect(await isValidSession(undefined, "ancien")).toBe(false);
    expect(await isValidSession("x".repeat(64), "ancien")).toBe(false);
    expect(await isValidSession(token, "nouveau")).toBe(false);
  });

  it("only the sign-in page, the clock and Next.js files are open", () => {
    expect(isPublicPath("/connexion")).toBe(true);
    expect(isPublicPath("/api/horloge")).toBe(true);
    expect(isPublicPath("/_next/static/chunk.js")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/journal/3/email")).toBe(false);
    expect(isPublicPath("/sources")).toBe(false);
  });
});
