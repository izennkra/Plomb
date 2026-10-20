import { timingSafeEqual } from "node:crypto";

/** The online clock calls with its secret token (header "Authorization: Bearer …" or "?token=…"). */
export function isClockAuthorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = header ?? new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(token);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
