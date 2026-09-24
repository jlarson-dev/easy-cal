export function buildContentSecurityPolicy(options?: { development?: boolean }) {
  // hash-wasm compiles Argon2id with WebAssembly and needs wasm-unsafe-eval.
  // Next.js HMR in development also needs unsafe-eval; production does not.
  // App Router and Clerk both require script-src unsafe-inline unless a
  // per-request nonce / strict-dynamic policy is used.
  const scriptEval = options?.development
    ? "'unsafe-eval' 'wasm-unsafe-eval'"
    : "'wasm-unsafe-eval'";

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${scriptEval} https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev",
    "font-src 'self' data:",
    "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.clerk.com https://clerk-telemetry.com https://*.clerk-telemetry.com https://img.clerk.com https://*.protect.clerk.com:*",
    "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function securityHeaders(production: boolean): Array<{ key: string; value: string }> {
  const headers = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy({ development: !production }),
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), publickey-credentials-get=(self), publickey-credentials-create=(self)",
    },
  ];

  if (production) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
