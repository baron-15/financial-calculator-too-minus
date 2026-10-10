import { describe, expect, it } from "vitest";
import { RateLimiter, clientKey } from "../../api/_lib/rateLimit";

describe("RateLimiter", () => {
  it("allows `limit` requests per window, then blocks with a Retry-After", () => {
    const rl = new RateLimiter({ limit: 3, windowMs: 60_000 });
    const t0 = 1_000_000;
    expect(rl.check("a", t0)).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
    expect(rl.check("a", t0 + 1).remaining).toBe(1);
    expect(rl.check("a", t0 + 2).remaining).toBe(0);
    const blocked = rl.check("a", t0 + 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(50);
  });

  it("slides the window: the oldest hit expires first", () => {
    const rl = new RateLimiter({ limit: 2, windowMs: 1_000 });
    rl.check("a", 0);
    rl.check("a", 500);
    expect(rl.check("a", 999).allowed).toBe(false);
    expect(rl.check("a", 1_001).allowed).toBe(true);
    expect(rl.check("a", 1_200).allowed).toBe(false);
  });

  it("tracks clients independently", () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 60_000 });
    expect(rl.check("a", 0).allowed).toBe(true);
    expect(rl.check("a", 1).allowed).toBe(false);
    expect(rl.check("b", 2).allowed).toBe(true);
  });

  it("blocked requests do not extend the window", () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 1_000 });
    rl.check("a", 0);
    for (let t = 100; t < 1_000; t += 100) expect(rl.check("a", t).allowed).toBe(false);
    expect(rl.check("a", 1_001).allowed).toBe(true);
  });

  it("bounds memory by evicting expired and then least-recent clients", () => {
    const rl = new RateLimiter({ limit: 5, windowMs: 1_000, maxKeys: 100 });
    for (let i = 0; i < 100; i++) rl.check(`old${i}`, 0);
    for (let i = 0; i < 150; i++) rl.check(`new${i}`, 5_000);
    expect(rl.size).toBeLessThanOrEqual(100);
    // The most recent client survived eviction and is still counted.
    expect(rl.check("new149", 5_001).remaining).toBe(3);
  });
});

describe("clientKey", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost/", { headers });
  it("uses the first X-Forwarded-For address", () => {
    expect(clientKey(req({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
  });
  it("falls back to other proxy headers, then a shared bucket", () => {
    expect(clientKey(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientKey(req({ "x-nf-client-connection-ip": "198.51.100.3" }))).toBe("198.51.100.3");
    expect(clientKey(req({}))).toBe("anonymous");
  });
});
