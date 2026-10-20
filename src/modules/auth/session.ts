/** Name of the cookie that keeps the reader signed in. */
export const SESSION_COOKIE = "plomb_session";
/** The reader stays signed in for 30 days on a device. */
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

/**
 * Proof of having typed the password, stored in the cookie (never the password itself). Changing the password
 * signs everybody out. Uses Web Crypto: works in the middleware and on the server.
 */
export async function sessionToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("plomb-session-v1"));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isValidSession(cookie: string | undefined, password: string): Promise<boolean> {
  if (!cookie) return false;
  return constantTimeEqual(cookie, await sessionToken(password));
}

/** Compares without revealing, by its duration, how much of the value was right. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** Paths that never ask for the password: sign-in page, clock (own token), image copies, Next.js files. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/connexion" ||
    pathname.startsWith("/api/horloge") ||
    // Copies of social images: also shown in the 9:00 e-mail, outside the app.
    pathname.startsWith("/media/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}
