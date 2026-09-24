import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETE_COPY,
  HEALTH_PAYLOAD,
  PRIVACY_COPY,
  TERMS_COPY,
} from "./copy";

describe("privacy policy", () => {
  it("states zero-knowledge storage of student schedules", () => {
    const text = PRIVACY_COPY.join("\n");
    expect(text).toMatch(/zero-knowledge/i);
    expect(text).toMatch(/cannot read student/i);
    expect(text).not.toMatch(/we sell/i);
    expect(text).toMatch(/do not sell/i);
    expect(text).toMatch(/do not (use|train).*(vault|student)/i);
  });
});

describe("terms of use", () => {
  it("states there is no recovery if passphrase and recovery key are lost", () => {
    const text = TERMS_COPY.join("\n");
    expect(text).toMatch(/no recovery/i);
    expect(text).toMatch(/passphrase/i);
    expect(text).toMatch(/recovery key/i);
  });
});

describe("account deletion", () => {
  it("warns that deleting the account removes vault ciphertext", () => {
    expect(ACCOUNT_DELETE_COPY.warning).toMatch(/ciphertext|encrypted vault/i);
    expect(ACCOUNT_DELETE_COPY.warning).toMatch(/cannot be recovered|cannot recover/i);
    expect(ACCOUNT_DELETE_COPY.confirmLabel).toMatch(/delete/i);
  });
});

describe("platform health", () => {
  it("returns an unauthenticated ok payload", () => {
    expect(HEALTH_PAYLOAD).toEqual({ ok: true });
  });
});
