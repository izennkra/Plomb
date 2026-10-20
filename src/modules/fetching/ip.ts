import { BlockList, isIP } from "node:net";

/** Addresses Plomb must never contact: the machine itself, private networks, cloud metadata… */
const internal = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  internal.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  internal.addSubnet(network, prefix, "ipv6");
}

export function isPublicIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return !internal.check(ip, "ipv4");
  if (version !== 6) return false;

  // IPv4 written as IPv6 (::ffff:127.0.0.1) must follow the IPv4 rules.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isPublicIp(mapped[1]);
  return !internal.check(ip, "ipv6");
}
