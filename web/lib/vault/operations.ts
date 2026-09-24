import type { StudentRecord, VaultDocument } from "./types";

export type ImportStudentJson = Record<
  string,
  {
    blocked_times?: Array<{
      day: string;
      start: string;
      end: string;
      label?: string | null;
    }>;
    can_overlap?: string[];
  }
>;

function cloneDocument(document: VaultDocument): VaultDocument {
  return structuredClone(document);
}

export function upsertStudent(
  document: VaultDocument,
  name: string,
  record: StudentRecord,
): VaultDocument {
  const next = cloneDocument(document);
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Student name is required");
  }
  next.students[trimmed] = {
    blockedTimes: record.blockedTimes,
    canOverlap: [...record.canOverlap],
  };
  delete next.deletedStudents[trimmed];
  return next;
}

export function importStudents(
  document: VaultDocument,
  payload: ImportStudentJson,
  overwrite: boolean,
): {
  document: VaultDocument;
  existing: string[];
  saved: string[];
} {
  const existing: string[] = [];
  const saved: string[] = [];
  let next = cloneDocument(document);

  for (const [name, data] of Object.entries(payload)) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }
    if (!overwrite && next.students[trimmed]) {
      existing.push(trimmed);
      continue;
    }
    next = upsertStudent(next, trimmed, {
      blockedTimes: (data.blocked_times || []).map((bt) => ({
        day: bt.day,
        start: bt.start,
        end: bt.end,
        label: bt.label ?? null,
      })),
      canOverlap: data.can_overlap || [],
    });
    saved.push(trimmed);
  }

  return { document: next, existing, saved };
}

export function updateStudentRecord(
  document: VaultDocument,
  name: string,
  record: StudentRecord,
): VaultDocument {
  return upsertStudent(document, name, record);
}

export function softDeleteStudent(
  document: VaultDocument,
  name: string,
  deletedAt = new Date().toISOString(),
): VaultDocument {
  const next = cloneDocument(document);
  const student = next.students[name];
  if (!student) {
    throw new Error("Student not found");
  }
  next.deletedStudents[name] = {
    deletedAt,
    blockedTimes: student.blockedTimes,
    canOverlap: student.canOverlap,
  };
  delete next.students[name];
  for (const other of Object.values(next.students)) {
    other.canOverlap = other.canOverlap.filter((peer) => peer !== name);
  }
  next.scheduler.students = next.scheduler.students.filter(
    (entry) => entry.name !== name,
  );
  return next;
}

export function restoreStudent(
  document: VaultDocument,
  name: string,
): VaultDocument {
  const next = cloneDocument(document);
  const deleted = next.deletedStudents[name];
  if (!deleted) {
    throw new Error("No deletion record found");
  }
  next.students[name] = {
    blockedTimes: deleted.blockedTimes,
    canOverlap: deleted.canOverlap,
  };
  delete next.deletedStudents[name];
  return next;
}

export function permanentlyDeleteStudent(
  document: VaultDocument,
  name: string,
): VaultDocument {
  const next = cloneDocument(document);
  if (!next.deletedStudents[name]) {
    throw new Error("No deletion record found");
  }
  delete next.deletedStudents[name];
  return next;
}

export function setSubjects(
  document: VaultDocument,
  subjects: string[],
): VaultDocument {
  const next = cloneDocument(document);
  next.subjects = [...subjects];
  return next;
}

export function setScheduler(
  document: VaultDocument,
  scheduler: VaultDocument["scheduler"],
): VaultDocument {
  const next = cloneDocument(document);
  next.scheduler = structuredClone(scheduler);
  return next;
}

export function addSavedSchedule(
  document: VaultDocument,
  name: string,
  result: unknown,
  savedAt = new Date().toISOString(),
): VaultDocument {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Schedule name is required");
  }
  const next = cloneDocument(document);
  if (next.savedSchedules.some((item) => item.name === trimmed)) {
    throw new Error("Schedule already exists");
  }
  next.savedSchedules.unshift({
    id: crypto.randomUUID(),
    name: trimmed,
    savedAt,
    result,
  });
  return next;
}

export function deleteSavedSchedule(
  document: VaultDocument,
  name: string,
): VaultDocument {
  const next = cloneDocument(document);
  const before = next.savedSchedules.length;
  next.savedSchedules = next.savedSchedules.filter((item) => item.name !== name);
  if (next.savedSchedules.length === before) {
    throw new Error("Schedule not found");
  }
  return next;
}

export function toViewStudents(document: VaultDocument) {
  const students: Record<
    string,
    {
      blocked_times: StudentRecord["blockedTimes"];
      can_overlap: string[];
    }
  > = {};
  for (const [name, record] of Object.entries(document.students)) {
    students[name] = {
      blocked_times: record.blockedTimes,
      can_overlap: record.canOverlap,
    };
  }
  return students;
}

export function exportStudentsJson(document: VaultDocument): string {
  return JSON.stringify(toViewStudents(document), null, 2);
}

export function studentRecordFromView(data: {
  blocked_times?: StudentRecord["blockedTimes"];
  can_overlap?: string[];
}): StudentRecord {
  return {
    blockedTimes: data.blocked_times || [],
    canOverlap: data.can_overlap || [],
  };
}

export type SchedulerUiConfig = {
  workingHours: { days: string[]; start_time: string; end_time: string };
  lunchTime: string;
  prepTimeRequired: boolean;
  students: Array<{
    name: string;
    color?: string | null;
    subjects: Array<{
      name: string;
      constraint_type?: "daily" | "weekly";
      daily_minutes?: number | null;
      weekly_days?: number | null;
      weekly_minutes_per_session?: number | null;
    }>;
  }>;
};

export function schedulerToUi(
  scheduler: VaultDocument["scheduler"],
): SchedulerUiConfig {
  return {
    workingHours: {
      days: [...scheduler.workingHours.days],
      start_time: scheduler.workingHours.startTime,
      end_time: scheduler.workingHours.endTime,
    },
    lunchTime: scheduler.lunchTime,
    prepTimeRequired: scheduler.prepTimeRequired,
    students: scheduler.students.map((student) => ({
      name: student.name,
      color: student.color,
      subjects: student.subjects.map((subject) => ({
        name: subject.name,
        constraint_type: subject.constraintType,
        daily_minutes: subject.dailyMinutes,
        weekly_days: subject.weeklyDays,
        weekly_minutes_per_session: subject.weeklyMinutesPerSession,
      })),
    })),
  };
}

export function schedulerFromUi(
  config: SchedulerUiConfig,
): VaultDocument["scheduler"] {
  return {
    workingHours: {
      days: [...config.workingHours.days],
      startTime: config.workingHours.start_time,
      endTime: config.workingHours.end_time,
    },
    lunchTime: config.lunchTime,
    prepTimeRequired: config.prepTimeRequired,
    students: config.students.map((student) => ({
      name: student.name,
      color: student.color ?? null,
      subjects: student.subjects.map((subject) => ({
        name: subject.name,
        constraintType: subject.constraint_type === "daily" ? "daily" : "weekly",
        dailyMinutes: subject.daily_minutes ?? null,
        weeklyDays: subject.weekly_days ?? null,
        weeklyMinutesPerSession: subject.weekly_minutes_per_session ?? null,
      })),
    })),
  };
}

export function deletedStudentsToView(document: VaultDocument) {
  return Object.entries(document.deletedStudents).map(([name, record]) => ({
    student_name: name,
    deleted_at: record.deletedAt,
    blocked_times: record.blockedTimes,
  }));
}

export function savedSchedulesToView(document: VaultDocument) {
  return document.savedSchedules.map((item) => ({
    name: item.name,
    filename: item.name,
    saved_at: item.savedAt,
  }));
}
