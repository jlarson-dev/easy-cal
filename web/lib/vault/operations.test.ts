import { describe, expect, it } from "vitest";
import { createEmptyVaultDocument } from "./document";
import {
  addSavedSchedule,
  exportStudentsJson,
  importStudents,
  permanentlyDeleteStudent,
  restoreStudent,
  schedulerFromUi,
  schedulerToUi,
  setSubjects,
  softDeleteStudent,
  upsertStudent,
} from "./operations";

describe("student vault operations", () => {
  it("creates, soft-deletes, restores, and permanently deletes a student", () => {
    let document = createEmptyVaultDocument();
    document = upsertStudent(document, "Ada", {
      blockedTimes: [
        { day: "Monday", start: "09:00", end: "10:00", label: "school" },
      ],
      canOverlap: [],
    });
    expect(document.students.Ada.blockedTimes).toHaveLength(1);

    document = softDeleteStudent(document, "Ada", "2026-01-01T00:00:00.000Z");
    expect(document.students.Ada).toBeUndefined();
    expect(document.deletedStudents.Ada.deletedAt).toBe(
      "2026-01-01T00:00:00.000Z",
    );

    document = restoreStudent(document, "Ada");
    expect(document.students.Ada.blockedTimes[0].label).toBe("school");
    expect(document.deletedStudents.Ada).toBeUndefined();

    document = softDeleteStudent(document, "Ada");
    document = permanentlyDeleteStudent(document, "Ada");
    expect(document.deletedStudents.Ada).toBeUndefined();
  });

  it("imports JSON students and reports duplicates unless overwrite is set", () => {
    let document = createEmptyVaultDocument();
    document = upsertStudent(document, "Ada", {
      blockedTimes: [],
      canOverlap: [],
    });

    const payload = {
      Ada: { blocked_times: [{ day: "Tuesday", start: "11:00", end: "12:00" }] },
      Beau: { blocked_times: [{ day: "Monday", start: "08:00", end: "09:00" }] },
    };

    const skipped = importStudents(document, payload, false);
    expect(skipped.existing).toEqual(["Ada"]);
    expect(skipped.saved).toEqual(["Beau"]);
    expect(skipped.document.students.Ada.blockedTimes).toHaveLength(0);

    const overwritten = importStudents(document, payload, true);
    expect(overwritten.existing).toEqual([]);
    expect(overwritten.document.students.Ada.blockedTimes[0].day).toBe(
      "Tuesday",
    );
  });

  it("updates subjects and rejects duplicate saved schedule names", () => {
    let document = setSubjects(createEmptyVaultDocument(), ["Math", "Art"]);
    expect(document.subjects).toEqual(["Math", "Art"]);

    document = addSavedSchedule(document, "Week 1", { schedule: [] });
    expect(document.savedSchedules[0].name).toBe("Week 1");
    expect(() => addSavedSchedule(document, "Week 1", { schedule: [] })).toThrow(
      /already exists/i,
    );
  });

  it("round-trips scheduler UI snake_case onto the vault document", () => {
    const document = createEmptyVaultDocument();
    const ui = schedulerToUi(document.scheduler);
    ui.lunchTime = "12:30";
    ui.workingHours.start_time = "09:00";
    ui.students = [
      {
        name: "Ada",
        color: "#87ceeb",
        subjects: [
          {
            name: "Math",
            constraint_type: "weekly",
            weekly_days: 2,
            weekly_minutes_per_session: 60,
          },
        ],
      },
    ];

    const roundTripped = schedulerToUi(schedulerFromUi(ui));
    expect(roundTripped.lunchTime).toBe("12:30");
    expect(roundTripped.workingHours.start_time).toBe("09:00");
    expect(roundTripped.students[0].subjects[0].weekly_days).toBe(2);
  });

  it("exports students in the desktop JSON shape", () => {
    const document = upsertStudent(createEmptyVaultDocument(), "Ada", {
      blockedTimes: [
        { day: "Monday", start: "09:00", end: "10:00", label: "school" },
      ],
      canOverlap: ["Beau"],
    });
    const exported = JSON.parse(exportStudentsJson(document)) as {
      Ada: { blocked_times: unknown[]; can_overlap: string[] };
    };
    expect(exported.Ada.blocked_times).toHaveLength(1);
    expect(exported.Ada.can_overlap).toEqual(["Beau"]);
  });
});
