import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, securityHeaders } from "./headers";

describe("security headers", () => {
  it("defaults to self and allowlists Clerk plus WASM KDF", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("https://*.clerk.accounts.dev");
    expect(csp).toContain("https://*.clerk.com");
    expect(csp).toContain("https://*.protect.clerk.com:*");
    expect(csp).toContain("wasm-unsafe-eval");
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).not.toMatch(/(?<!wasm-)unsafe-eval/);
  });

  it("adds HSTS only in production", () => {
    const prod = securityHeaders(true);
    const dev = securityHeaders(false);
    expect(prod.find((header) => header.key === "Strict-Transport-Security")?.value).toMatch(
      /max-age=63072000/,
    );
    expect(dev.find((header) => header.key === "Strict-Transport-Security")).toBeUndefined();
    expect(
      prod.find((header) => header.key === "Permissions-Policy")?.value,
    ).toContain("publickey-credentials-get=(self)");
  });
});
