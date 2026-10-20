import { describe, expect, it } from "vitest";
import { isClockAuthorized } from "@/modules/planification/clock-auth";

const call = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe("isClockAuthorized", () => {
  it("accepts the right token, in the header or the address", () => {
    expect(isClockAuthorized(call("https://p.app/api/horloge", { authorization: "Bearer s3cret" }), "s3cret")).toBe(true);
    expect(isClockAuthorized(call("https://p.app/api/horloge?token=s3cret"), "s3cret")).toBe(true);
  });

  it("refuses a wrong or missing token, and everything when no secret is set", () => {
    expect(isClockAuthorized(call("https://p.app/api/horloge", { authorization: "Bearer nope" }), "s3cret")).toBe(false);
    expect(isClockAuthorized(call("https://p.app/api/horloge"), "s3cret")).toBe(false);
    expect(isClockAuthorized(call("https://p.app/api/horloge?token="), undefined)).toBe(false);
  });
});
