import { DEFAULT_SUBJECTS, type VaultDocument } from "./types";

export function createEmptyVaultDocument(): VaultDocument {
  return {
    schemaVersion: 1,
    subjects: [...DEFAULT_SUBJECTS],
    students: {},
    deletedStudents: {},
    scheduler: {
      workingHours: {
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        startTime: "08:00",
        endTime: "17:00",
      },
      lunchTime: "12:00",
      prepTimeRequired: true,
      students: [],
    },
    savedSchedules: [],
  };
}
