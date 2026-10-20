import { describe, expect, it } from "vitest";
import { isPublicIp } from "@/modules/fetching/ip";

describe("isPublicIp", () => {
  it.each(["93.184.216.34", "151.101.1.140", "2606:4700::6810:84e5"])("accepts public address %s", (ip) => {
    expect(isPublicIp(ip)).toBe(true);
  });

  it.each([
    "127.0.0.1",
    "10.0.0.5",
    "172.16.3.4",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
  ])("refuses internal address %s", (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });

  it("refuses something that is not an IP", () => {
    expect(isPublicIp("not-an-ip")).toBe(false);
  });
});
