import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";

/**
 * Downloads an image for the MCP `upload_media` tool without letting a caller reach internal services (SSRF):
 * https only, every resolved address must be public (checked inside the socket's DNS lookup, so DNS rebinding
 * can't swap in a private IP after the check), at most 3 redirects (each re-checked), a size cap and a timeout.
 */
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  // No ::ffff:0:0/96 here: Node's BlockList matches every plain IPv4 address against it. IPv4-mapped IPv6
  // addresses are unwrapped and checked as IPv4 in isPublicAddress instead.
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(net, prefix, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return !blocked.check(mapped, "ipv4");
  return !blocked.check(address, family === 6 ? "ipv6" : "ipv4");
}

export class ImageFetchError extends Error {}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
function safeLookup(hostname: string, options: { all?: boolean }, cb: LookupCb): void {
  dnsLookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err, "");
    if (!addrs.length || addrs.some((a) => !isPublicAddress(a.address))) {
      return cb(Object.assign(new ImageFetchError("That address is not a public website."), { code: "EBLOCKED" }), "");
    }
    if (options.all) return cb(null, addrs);
    cb(null, addrs[0]!.address, addrs[0]!.family);
  });
}

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImageFetchError("Invalid URL.");
  }
  if (url.protocol !== "https:") throw new ImageFetchError("Only https:// image URLs are allowed.");
  if (url.username || url.password) throw new ImageFetchError("URLs with credentials are not allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new ImageFetchError("That address is not a public website.");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new ImageFetchError("That address is not a public website.");
  return url;
}

function getOnce(url: URL, maxBytes: number, timeoutMs: number): Promise<{ redirect?: string; body?: Buffer; type?: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET", lookup: safeLookup as never, timeout: timeoutMs, headers: { "user-agent": "ShivanshiGamingHub-MediaFetch/1.0", accept: "image/*" } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ redirect: new URL(res.headers.location, url).toString() });
      }
      if (status !== 200) {
        res.resume();
        return reject(new ImageFetchError(`The image URL returned HTTP ${status}.`));
      }
      const type = String(res.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
      if (type && !type.startsWith("image/") && type !== "application/octet-stream") {
        res.resume();
        return reject(new ImageFetchError(`That URL is not an image (it returned ${type}).`));
      }
      if (Number(res.headers["content-length"] ?? 0) > maxBytes) {
        res.resume();
        return reject(new ImageFetchError(`The image is larger than ${Math.round(maxBytes / 1048576)} MB.`));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => {
        size += c.length;
        if (size > maxBytes) {
          req.destroy(new ImageFetchError(`The image is larger than ${Math.round(maxBytes / 1048576)} MB.`));
          return;
        }
        chunks.push(c);
      });
      res.on("end", () => resolve({ body: Buffer.concat(chunks), type }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new ImageFetchError("The image download timed out.")));
    req.on("error", (e) => reject(e instanceof ImageFetchError ? e : new ImageFetchError(`Could not download the image (${(e as NodeJS.ErrnoException).code ?? e.message}).`)));
    req.end();
  });
}

export async function fetchImage(raw: string, maxBytes: number, timeoutMs = 15_000): Promise<{ buffer: Buffer; filename: string }> {
  let url = checkUrl(raw);
  for (let hop = 0; hop <= 3; hop++) {
    const r = await getOnce(url, maxBytes, timeoutMs);
    if (r.body) {
      const name = decodeURIComponent(url.pathname.split("/").pop() || "image").replace(/[^\w.-]+/g, "-").slice(0, 120) || "image";
      return { buffer: r.body, filename: name };
    }
    url = checkUrl(r.redirect!);
  }
  throw new ImageFetchError("Too many redirects.");
}
