export type ScheduleRequest = {
  students: Record<
    string,
    {
      blocked_times: Array<{
        day: string;
        start: string;
        end: string;
        label?: string | null;
      }>;
      can_overlap?: string[];
    }
  >;
  student_configs: Array<{
    name: string;
    subjects: Array<{
      name: string;
      constraint_type: "daily" | "weekly";
      daily_minutes?: number | null;
      weekly_days?: number | null;
      weekly_minutes_per_session?: number | null;
    }>;
    color?: string | null;
  }>;
  working_hours: { days: string[]; start_time: string; end_time: string };
  lunch_time: string;
  prep_time_required?: boolean;
};

export type TimeSlot = {
  day: string;
  start: string;
  end: string;
  student?: string | null;
  students?: string[] | null;
  subject?: string | null;
  type: string;
  label?: string | null;
};

export type ScheduleResponse = {
  schedule: TimeSlot[];
  success: boolean;
  message?: string | null;
  conflicts?: string[] | null;
};

type StudentConfig = ScheduleRequest["student_configs"][number];
type SlotRange = [number, number];

function timeToMinutes(timeStr: string): number {
  const [hour, minute] = timeStr.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getBlockedSlotsForDay(
  day: string,
  studentSchedules: ScheduleRequest["students"],
  workingStart: string,
  workingEnd: string,
  slotDuration = 30,
): SlotRange[] {
  const blockedSlots: SlotRange[] = [];

  for (const schedule of Object.values(studentSchedules)) {
    for (const blockedTime of schedule.blocked_times) {
      if (blockedTime.day.toLowerCase() === day.toLowerCase()) {
        let startMins = timeToMinutes(blockedTime.start);
        let endMins = timeToMinutes(blockedTime.end);

        const workStartMins = timeToMinutes(workingStart);
        const workEndMins = timeToMinutes(workingEnd);
        startMins = Math.max(startMins, workStartMins);
        endMins = Math.min(endMins, workEndMins);

        let current = startMins;
        while (current < endMins) {
          const slotEnd = Math.min(current + slotDuration, endMins);
          blockedSlots.push([current, slotEnd]);
          current = slotEnd;
        }
      }
    }
  }

  return blockedSlots;
}

function generateAvailableSlots(
  _day: string,
  workingStart: string,
  workingEnd: string,
  blockedSlots: SlotRange[],
  slotDuration = 30,
): SlotRange[] {
  const workStartMins = timeToMinutes(workingStart);
  const workEndMins = timeToMinutes(workingEnd);

  const sortedBlocked = [...blockedSlots].sort((a, b) => a[0] - b[0]);

  const available: SlotRange[] = [];
  let current = workStartMins;

  for (const [blockedStart, blockedEnd] of sortedBlocked) {
    if (current < blockedStart) {
      while (current < blockedStart) {
        const slotEnd = Math.min(current + slotDuration, blockedStart);
        if (slotEnd > current) {
          available.push([current, slotEnd]);
        }
        current = slotEnd;
      }
    }

    current = Math.max(current, blockedEnd);
  }

  while (current < workEndMins) {
    const slotEnd = Math.min(current + slotDuration, workEndMins);
    if (slotEnd > current) {
      available.push([current, slotEnd]);
    }
    current = slotEnd;
  }

  return available;
}

function canStudentsOverlap(
  student1: string,
  student2: string,
  studentSchedules: ScheduleRequest["students"],
): boolean {
  if (!(student1 in studentSchedules) || !(student2 in studentSchedules)) {
    return false;
  }

  const schedule1 = studentSchedules[student1];
  const schedule2 = studentSchedules[student2];

  const canOverlap1 = schedule1.can_overlap ?? [];
  const canOverlap2 = schedule2.can_overlap ?? [];

  return canOverlap1.includes(student2) && canOverlap2.includes(student1);
}

function checkAllCanOverlap(
  studentNames: string[],
  studentSchedules: ScheduleRequest["students"],
): boolean {
  if (studentNames.length < 2) {
    return true;
  }

  for (let i = 0; i < studentNames.length; i++) {
    for (let j = i + 1; j < studentNames.length; j++) {
      if (
        !canStudentsOverlap(studentNames[i], studentNames[j], studentSchedules)
      ) {
        return false;
      }
    }
  }

  return true;
}

function areStudentsBlockedAtTime(
  studentNames: string[],
  day: string,
  slotStartMins: number,
  slotEndMins: number,
  studentSchedules: ScheduleRequest["students"],
): boolean {
  for (const studentName of studentNames) {
    if (!(studentName in studentSchedules)) {
      continue;
    }

    const schedule = studentSchedules[studentName];
    for (const blockedTime of schedule.blocked_times) {
      if (blockedTime.day.toLowerCase() === day.toLowerCase()) {
        const blockedStart = timeToMinutes(blockedTime.start);
        const blockedEnd = timeToMinutes(blockedTime.end);

        if (!(slotEndMins <= blockedStart || slotStartMins >= blockedEnd)) {
          return true;
        }
      }
    }
  }

  return false;
}

function slotsNeededForMinutes(maxMinutes: number, slotDuration: number): number {
  let slotsNeeded = Math.floor((maxMinutes + slotDuration - 1) / slotDuration);
  if (slotsNeeded === 0) {
    slotsNeeded = 1;
  }
  return slotsNeeded;
}

export function generateSchedule(request: ScheduleRequest): ScheduleResponse {
  const slotDuration = 30;
  const schedule: TimeSlot[] = [];
  const conflicts: string[] = [];
  const prepTimeRequired = request.prep_time_required ?? true;

  const studentConfigDict: Record<string, StudentConfig> = {};
  for (const config of request.student_configs) {
    studentConfigDict[config.name] = config;
  }

  const scheduledMinutesByDay: Record<string, Record<string, Record<string, number>>> =
    {};
  const scheduledWeeklyMinutes: Record<string, Record<string, number>> = {};
  const scheduledWeeklySessions: Record<string, Record<string, number>> = {};
  const weeklySubjectsByDay: Record<string, Record<string, Set<string>>> = {};

  for (const config of request.student_configs) {
    scheduledMinutesByDay[config.name] = {};
    scheduledWeeklyMinutes[config.name] = {};
    scheduledWeeklySessions[config.name] = {};
    weeklySubjectsByDay[config.name] = {};
    for (const subj of config.subjects) {
      scheduledMinutesByDay[config.name][subj.name] = {};
      scheduledWeeklyMinutes[config.name][subj.name] = 0;
      scheduledWeeklySessions[config.name][subj.name] = 0;
    }
  }

  const lunchMins = timeToMinutes(request.lunch_time);

  for (const day of request.working_hours.days) {
    schedule.push({
      day,
      start: request.lunch_time,
      end: minutesToTime(lunchMins + 30),
      type: "lunch",
    });

    for (const studentName of Object.keys(scheduledMinutesByDay)) {
      for (const subjectName of Object.keys(scheduledMinutesByDay[studentName])) {
        scheduledMinutesByDay[studentName][subjectName][day] = 0;
      }
      if (!(day in weeklySubjectsByDay[studentName])) {
        weeklySubjectsByDay[studentName][day] = new Set();
      }
    }
  }

  const blockedByDay: Record<string, SlotRange[]> = {};
  for (const day of request.working_hours.days) {
    blockedByDay[day] = getBlockedSlotsForDay(
      day,
      request.students,
      request.working_hours.start_time,
      request.working_hours.end_time,
      slotDuration,
    );

    const lunchStart = lunchMins;
    const lunchEnd = lunchMins + 30;

    let current = lunchStart;
    while (current < lunchEnd) {
      const slotEnd = Math.min(current + slotDuration, lunchEnd);
      blockedByDay[day].push([current, slotEnd]);
      current = slotEnd;
    }
  }

  for (const day of request.working_hours.days) {
    for (const studentSchedule of Object.values(request.students)) {
      for (const blockedTime of studentSchedule.blocked_times) {
        if (blockedTime.day.toLowerCase() === day.toLowerCase()) {
          const blockedStartMins = timeToMinutes(blockedTime.start);
          const blockedEndMins = timeToMinutes(blockedTime.end);
          const workStartMins = timeToMinutes(request.working_hours.start_time);
          const workEndMins = timeToMinutes(request.working_hours.end_time);

          if (blockedEndMins > workStartMins && blockedStartMins < workEndMins) {
            const startMins = Math.max(blockedStartMins, workStartMins);
            const endMins = Math.min(blockedEndMins, workEndMins);

            schedule.push({
              day,
              start: minutesToTime(startMins),
              end: minutesToTime(endMins),
              type: "blocked",
              label: blockedTime.label,
            });
          }
        }
      }
    }
  }

  const availableByDay: Record<string, SlotRange[]> = {};
  for (const day of request.working_hours.days) {
    availableByDay[day] = generateAvailableSlots(
      day,
      request.working_hours.start_time,
      request.working_hours.end_time,
      blockedByDay[day],
      slotDuration,
    );
  }

  for (const day of request.working_hours.days) {
    if (!(day in availableByDay)) {
      continue;
    }

    const subjectGroups: Record<string, string[]> = {};

    for (const studentConfig of request.student_configs) {
      const studentName = studentConfig.name;
      for (const subject of studentConfig.subjects) {
        if (subject.constraint_type === "daily" && subject.daily_minutes) {
          const scheduledToday =
            scheduledMinutesByDay[studentName][subject.name][day] ?? 0;
          if (scheduledToday < subject.daily_minutes) {
            if (!(subject.name in subjectGroups)) {
              subjectGroups[subject.name] = [];
            }
            subjectGroups[subject.name].push(studentName);
          }
        }
      }
    }

    for (const [subjectName, studentsNeeding] of Object.entries(subjectGroups)) {
      if (!studentsNeeding.length) {
        continue;
      }

      while (true) {
        const remainingStudents: string[] = [];
        for (const studentName of studentsNeeding) {
          const scheduledToday =
            scheduledMinutesByDay[studentName][subjectName][day] ?? 0;
          const studentNeeds =
            studentConfigDict[studentName].subjects.find(
              (subj) =>
                subj.name === subjectName && subj.constraint_type === "daily",
            )?.daily_minutes ?? 0;
          if (scheduledToday < studentNeeds) {
            remainingStudents.push(studentName);
          }
        }

        if (!remainingStudents.length) {
          break;
        }

        let maxMinutes = 0;
        for (const studentName of remainingStudents) {
          for (const subj of studentConfigDict[studentName].subjects) {
            if (subj.name === subjectName && subj.constraint_type === "daily") {
              maxMinutes = Math.max(maxMinutes, subj.daily_minutes ?? 0);
              break;
            }
          }
        }

        let availableSlots = availableByDay[day];
        if (!availableSlots.length) {
          break;
        }

        const slotsNeeded = slotsNeededForMinutes(maxMinutes, slotDuration);

        let bestGroup: string[] | null = null;
        let bestSlotIndex: number | null = null;
        let bestSlotInfo: [number, number, number] | null = null;

        for (let i = 0; i < availableSlots.length - slotsNeeded + 1; i++) {
          const consecutiveSlots = availableSlots.slice(i, i + slotsNeeded);
          const slotStartMins = consecutiveSlots[0][0];
          const slotEndMins = consecutiveSlots[consecutiveSlots.length - 1][1];
          const actualMinutes = slotEndMins - slotStartMins;

          if (actualMinutes < maxMinutes) {
            continue;
          }

          const lunchStartMins = lunchMins;
          const lunchEndMins = lunchMins + 30;
          const overlapsLunch = !(
            slotEndMins <= lunchStartMins || slotStartMins >= lunchEndMins
          );
          if (overlapsLunch) {
            continue;
          }

          const potentialGroup: string[] = [];
          for (const studentName of remainingStudents) {
            if (
              areStudentsBlockedAtTime(
                [studentName],
                day,
                slotStartMins,
                slotEndMins,
                request.students,
              )
            ) {
              continue;
            }

            if (
              checkAllCanOverlap(
                [...potentialGroup, studentName],
                request.students,
              )
            ) {
              potentialGroup.push(studentName);
            }
          }

          if (
            potentialGroup.length &&
            (bestGroup === null || potentialGroup.length > bestGroup.length)
          ) {
            bestGroup = potentialGroup;
            bestSlotIndex = i;
            bestSlotInfo = [slotStartMins, slotEndMins, actualMinutes];
          }
        }

        if (bestGroup && bestSlotInfo) {
          const [slotStartMins, slotEndMins, actualMinutes] = bestSlotInfo;

          if (bestGroup.length > 1) {
            schedule.push({
              day,
              start: minutesToTime(slotStartMins),
              end: minutesToTime(slotEndMins),
              students: bestGroup,
              subject: subjectName,
              type: "session",
            });
          } else {
            schedule.push({
              day,
              start: minutesToTime(slotStartMins),
              end: minutesToTime(slotEndMins),
              student: bestGroup[0],
              subject: subjectName,
              type: "session",
            });
          }

          for (const student of bestGroup) {
            scheduledMinutesByDay[student][subjectName][day] = actualMinutes;
            scheduledWeeklyMinutes[student][subjectName] += actualMinutes;
            scheduledWeeklySessions[student][subjectName] += 1;
          }

          const slotsUsed = Math.floor(
            (actualMinutes + slotDuration - 1) / slotDuration,
          );
          availableSlots = availableSlots.slice((bestSlotIndex ?? 0) + slotsUsed);
          availableByDay[day] = availableSlots;
        } else {
          break;
        }
      }
    }
  }

  for (const day of request.working_hours.days) {
    if (!(day in availableByDay)) {
      continue;
    }

    const subjectGroups: Record<string, string[]> = {};

    for (const studentConfig of request.student_configs) {
      const studentName = studentConfig.name;
      for (const subject of studentConfig.subjects) {
        if (
          subject.constraint_type === "weekly" &&
          subject.weekly_days &&
          subject.weekly_minutes_per_session
        ) {
          const currentSessions = scheduledWeeklySessions[studentName][subject.name];
          if (currentSessions < subject.weekly_days) {
            if (!(subject.name in subjectGroups)) {
              subjectGroups[subject.name] = [];
            }
            subjectGroups[subject.name].push(studentName);
          }
        }
      }
    }

    for (const [subjectName, studentsNeeding] of Object.entries(subjectGroups)) {
      if (!studentsNeeding.length) {
        continue;
      }

      while (true) {
        const remainingStudents: string[] = [];
        for (const studentName of studentsNeeding) {
          const currentSessions = scheduledWeeklySessions[studentName][subjectName];
          const sessionsNeeded =
            studentConfigDict[studentName].subjects.find(
              (subj) =>
                subj.name === subjectName && subj.constraint_type === "weekly",
            )?.weekly_days ?? 0;
          const alreadyScheduledToday = (
            weeklySubjectsByDay[studentName][day] ?? new Set()
          ).has(subjectName);
          if (currentSessions < sessionsNeeded && !alreadyScheduledToday) {
            remainingStudents.push(studentName);
          }
        }

        if (!remainingStudents.length) {
          break;
        }

        let maxMinutes = 0;
        for (const studentName of remainingStudents) {
          for (const subj of studentConfigDict[studentName].subjects) {
            if (
              subj.name === subjectName &&
              subj.constraint_type === "weekly" &&
              subj.weekly_minutes_per_session
            ) {
              maxMinutes = Math.max(maxMinutes, subj.weekly_minutes_per_session);
              break;
            }
          }
        }

        let availableSlots = availableByDay[day];
        if (!availableSlots.length) {
          break;
        }

        const slotsNeeded = slotsNeededForMinutes(maxMinutes, slotDuration);

        let bestGroup: string[] | null = null;
        let bestSlotIndex: number | null = null;
        let bestSlotInfo: [number, number, number] | null = null;

        for (let i = 0; i < availableSlots.length - slotsNeeded + 1; i++) {
          const consecutiveSlots = availableSlots.slice(i, i + slotsNeeded);
          const slotStartMins = consecutiveSlots[0][0];
          const slotEndMins = consecutiveSlots[consecutiveSlots.length - 1][1];
          const actualMinutes = slotEndMins - slotStartMins;

          if (actualMinutes < maxMinutes) {
            continue;
          }

          const lunchStartMins = lunchMins;
          const lunchEndMins = lunchMins + 30;
          const overlapsLunch = !(
            slotEndMins <= lunchStartMins || slotStartMins >= lunchEndMins
          );
          if (overlapsLunch) {
            continue;
          }

          const potentialGroup: string[] = [];
          for (const studentName of remainingStudents) {
            if (
              areStudentsBlockedAtTime(
                [studentName],
                day,
                slotStartMins,
                slotEndMins,
                request.students,
              )
            ) {
              continue;
            }

            if (
              checkAllCanOverlap(
                [...potentialGroup, studentName],
                request.students,
              )
            ) {
              potentialGroup.push(studentName);
            }
          }

          if (
            potentialGroup.length &&
            (bestGroup === null || potentialGroup.length > bestGroup.length)
          ) {
            bestGroup = potentialGroup;
            bestSlotIndex = i;
            bestSlotInfo = [slotStartMins, slotEndMins, actualMinutes];
          }
        }

        if (bestGroup && bestSlotInfo) {
          const [slotStartMins, slotEndMins, actualMinutes] = bestSlotInfo;

          if (bestGroup.length > 1) {
            schedule.push({
              day,
              start: minutesToTime(slotStartMins),
              end: minutesToTime(slotEndMins),
              students: bestGroup,
              subject: subjectName,
              type: "session",
            });
          } else {
            schedule.push({
              day,
              start: minutesToTime(slotStartMins),
              end: minutesToTime(slotEndMins),
              student: bestGroup[0],
              subject: subjectName,
              type: "session",
            });
          }

          for (const student of bestGroup) {
            if (!(day in scheduledMinutesByDay[student][subjectName])) {
              scheduledMinutesByDay[student][subjectName][day] = 0;
            }
            scheduledMinutesByDay[student][subjectName][day] += actualMinutes;
            scheduledWeeklyMinutes[student][subjectName] += actualMinutes;
            scheduledWeeklySessions[student][subjectName] += 1;
            if (!(day in weeklySubjectsByDay[student])) {
              weeklySubjectsByDay[student][day] = new Set();
            }
            weeklySubjectsByDay[student][day].add(subjectName);
          }

          const slotsUsed = Math.floor(
            (actualMinutes + slotDuration - 1) / slotDuration,
          );
          availableSlots = availableSlots.slice((bestSlotIndex ?? 0) + slotsUsed);
          availableByDay[day] = availableSlots;
        } else {
          break;
        }
      }
    }
  }

  if (prepTimeRequired) {
    for (const day of request.working_hours.days) {
      const scheduledSessions = schedule
        .filter((s) => s.day === day && s.type === "session")
        .map(
          (s): SlotRange => [timeToMinutes(s.start), timeToMinutes(s.end)],
        );

      const allBlocked = [...blockedByDay[day], ...scheduledSessions];
      allBlocked.sort((a, b) => a[0] - b[0]);

      const dayAvailable = generateAvailableSlots(
        day,
        request.working_hours.start_time,
        request.working_hours.end_time,
        allBlocked,
        slotDuration,
      );

      let prepScheduled = false;
      for (let i = 0; i < dayAvailable.length - 1; i++) {
        const slot1 = dayAvailable[i];
        const slot2 = dayAvailable[i + 1];

        if (slot1[1] === slot2[0] && slot2[1] - slot1[0] >= 60) {
          const prepStart = slot1[0];
          const prepEnd = slot1[0] + 60;

          schedule.push({
            day,
            start: minutesToTime(prepStart),
            end: minutesToTime(prepEnd),
            type: "prep",
          });
          prepScheduled = true;
          break;
        }
      }

      if (!prepScheduled && dayAvailable.length >= 2) {
        const slot1 = dayAvailable[0];
        const slot2 = dayAvailable.length > 1 ? dayAvailable[1] : null;

        if (slot2 && slot2[1] - slot1[0] >= 60) {
          schedule.push({
            day,
            start: minutesToTime(slot1[0]),
            end: minutesToTime(slot1[0] + 30),
            type: "prep",
          });
          schedule.push({
            day,
            start: minutesToTime(slot1[0] + 30),
            end: minutesToTime(slot1[0] + 60),
            type: "prep",
          });
          prepScheduled = true;
        }
      }

      if (!prepScheduled) {
        conflicts.push(`Could not schedule prep time on ${day}`);
      }
    }
  }

  for (const studentConfig of request.student_configs) {
    const studentName = studentConfig.name;

    for (const subject of studentConfig.subjects) {
      if (subject.constraint_type === "daily" && subject.daily_minutes) {
        for (const day of request.working_hours.days) {
          const scheduledMinutes =
            scheduledMinutesByDay[studentName][subject.name][day] ?? 0;
          if (scheduledMinutes < subject.daily_minutes) {
            conflicts.push(
              `${studentName} - ${subject.name} on ${day}: ` +
                `Scheduled ${scheduledMinutes}min, needed ${subject.daily_minutes}min daily`,
            );
          }
        }
      }

      if (subject.constraint_type === "weekly") {
        if (subject.weekly_days && subject.weekly_minutes_per_session) {
          const scheduledSessionsCount =
            scheduledWeeklySessions[studentName][subject.name];
          const scheduledMinutes = scheduledWeeklyMinutes[studentName][subject.name];
          const neededSessions = subject.weekly_days;
          const neededMinutes =
            subject.weekly_days * subject.weekly_minutes_per_session;

          if (scheduledSessionsCount < neededSessions) {
            conflicts.push(
              `${studentName} - ${subject.name}: ` +
                `Scheduled ${scheduledSessionsCount} sessions, needed ${neededSessions} sessions per week`,
            );
          }

          if (scheduledMinutes < neededMinutes) {
            conflicts.push(
              `${studentName} - ${subject.name}: ` +
                `Scheduled ${scheduledMinutes}min total, needed ${neededMinutes}min per week ` +
                `(${neededSessions} sessions × ${subject.weekly_minutes_per_session}min)`,
            );
          }
        }
      }
    }
  }

  const dayOrder: Record<string, number> = {};
  request.working_hours.days.forEach((day, i) => {
    dayOrder[day] = i;
  });
  schedule.sort((a, b) => {
    const dayDiff = (dayOrder[a.day] ?? 999) - (dayOrder[b.day] ?? 999);
    if (dayDiff !== 0) {
      return dayDiff;
    }
    return timeToMinutes(a.start) - timeToMinutes(b.start);
  });

  const success = conflicts.length === 0;

  return {
    schedule,
    success,
    message: success
      ? "Schedule generated successfully"
      : "Schedule generated with conflicts",
    conflicts: conflicts.length ? conflicts : null,
  };
}
