import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateSchedule, type ScheduleRequest } from "./generate";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);
const oraclePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "oracle.py",
);

function pythonExecutable(): string {
  const candidates = process.platform === "win32" ? ["python", "py"] : ["python3", "python"];
  for (const command of candidates) {
    try {
      execFileSync(command, ["--version"], { stdio: "ignore" });
      return command;
    } catch {
      continue;
    }
  }
  throw new Error("Python is required to run scheduler golden tests against the oracle");
}

function pythonOracle(request: ScheduleRequest) {
  const python = pythonExecutable();
  const args = python === "py" ? ["-3", oraclePath] : [oraclePath];
  const stdout = execFileSync(python, args, {
    input: JSON.stringify(request),
    encoding: "utf8",
  });
  return JSON.parse(stdout) as unknown;
}

function canonicalize(response: unknown) {
  const value = JSON.parse(JSON.stringify(response)) as {
    schedule: Array<Record<string, unknown>>;
    success: boolean;
    message?: string | null;
    conflicts?: string[] | null;
  };
  return {
    success: value.success,
    message: value.message ?? null,
    conflicts: value.conflicts ?? null,
    schedule: value.schedule.map((slot) => {
      const next: Record<string, unknown> = {};
      for (const key of Object.keys(slot).sort()) {
        if (slot[key] !== null && slot[key] !== undefined) {
          next[key] = slot[key];
        }
      }
      return next;
    }),
  };
}

const requests = readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".request.json"))
  .sort();

describe("generateSchedule matches the Python oracle", () => {
  it("has the fixture suite required by the spec", () => {
    expect(requests).toEqual(
      expect.arrayContaining([
        "john-smith-blocked.request.json",
        "lunch-only.request.json",
        "overlap-bidirectional.request.json",
        "overlap-one-way.request.json",
        "sample-alice-bob-charlie.request.json",
        "weekly-unsatisfiable.request.json",
      ]),
    );
  });

  it.each(requests)("matches Python for %s", (name) => {
    const request = JSON.parse(
      readFileSync(path.join(fixturesDir, name), "utf8"),
    ) as ScheduleRequest;
    const python = pythonOracle(request);
    const typescript = generateSchedule(request);
    expect(canonicalize(typescript)).toEqual(canonicalize(python));
  }, 20_000);
});
