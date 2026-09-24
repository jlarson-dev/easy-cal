import { describe, expect, it } from "vitest";
import { generateSchedule, type ScheduleRequest } from "./generate";

const baseHours = {
  days: ["Monday"],
  start_time: "09:00",
  end_time: "12:00",
};

describe("generateSchedule", () => {
  it("still produces lunch slots for working days when blocked times are empty", () => {
    const request: ScheduleRequest = {
      students: {
        Alice: { blocked_times: [] },
      },
      student_configs: [
        {
          name: "Alice",
          subjects: [],
        },
      ],
      working_hours: {
        days: ["Monday", "Wednesday"],
        start_time: "09:00",
        end_time: "15:00",
      },
      lunch_time: "12:00",
      prep_time_required: false,
    };

    const result = generateSchedule(request);
    const lunches = result.schedule.filter((slot) => slot.type === "lunch");

    expect(lunches).toHaveLength(2);
    expect(lunches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          day: "Monday",
          start: "12:00",
          end: "12:30",
          type: "lunch",
        }),
        expect.objectContaining({
          day: "Wednesday",
          start: "12:00",
          end: "12:30",
          type: "lunch",
        }),
      ]),
    );
  });

  it("requires bidirectional overlap for multi-student sessions", () => {
    const oneWay: ScheduleRequest = {
      students: {
        Alice: { blocked_times: [], can_overlap: ["Bob"] },
        Bob: { blocked_times: [], can_overlap: [] },
      },
      student_configs: [
        {
          name: "Alice",
          subjects: [
            {
              name: "Math",
              constraint_type: "daily",
              daily_minutes: 30,
            },
          ],
        },
        {
          name: "Bob",
          subjects: [
            {
              name: "Math",
              constraint_type: "daily",
              daily_minutes: 30,
            },
          ],
        },
      ],
      working_hours: baseHours,
      lunch_time: "11:00",
      prep_time_required: false,
    };

    const oneWayResult = generateSchedule(oneWay);
    const oneWaySessions = oneWayResult.schedule.filter(
      (slot) => slot.type === "session",
    );
    expect(oneWaySessions.some((slot) => (slot.students?.length ?? 0) > 1)).toBe(
      false,
    );
    expect(oneWaySessions.length).toBeGreaterThanOrEqual(2);

    const bothWays: ScheduleRequest = {
      ...oneWay,
      students: {
        Alice: { blocked_times: [], can_overlap: ["Bob"] },
        Bob: { blocked_times: [], can_overlap: ["Alice"] },
      },
    };

    const bothWaysResult = generateSchedule(bothWays);
    const bothWaysSessions = bothWaysResult.schedule.filter(
      (slot) => slot.type === "session",
    );
    expect(
      bothWaysSessions.some(
        (slot) =>
          slot.students?.includes("Alice") && slot.students?.includes("Bob"),
      ),
    ).toBe(true);
  });

  it("reports a weekly constraint conflict when hours cannot fit", () => {
    const request: ScheduleRequest = {
      students: {
        Alice: { blocked_times: [] },
      },
      student_configs: [
        {
          name: "Alice",
          subjects: [
            {
              name: "Reading",
              constraint_type: "weekly",
              weekly_days: 3,
              weekly_minutes_per_session: 60,
            },
          ],
        },
      ],
      working_hours: {
        days: ["Monday"],
        start_time: "09:00",
        end_time: "10:00",
      },
      lunch_time: "09:00",
      prep_time_required: false,
    };

    const result = generateSchedule(request);

    expect(result.success).toBe(false);
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /Alice - Reading:.*Scheduled \d+ sessions, needed 3 sessions per week/,
        ),
      ]),
    );
  });
});
