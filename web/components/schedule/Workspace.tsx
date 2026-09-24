"use client";

import { useMemo, useState } from "react";
import CreateStudentSchedule from "@/components/schedule/CreateStudentSchedule";
import DeletedStudentsView from "@/components/schedule/DeletedStudentsView";
import SavedSchedulesManager from "@/components/schedule/SavedSchedulesManager";
import ScheduleDisplay from "@/components/schedule/ScheduleDisplay";
import SchedulerConfiguration from "@/components/schedule/SchedulerConfiguration";
import StudentScheduleUpload from "@/components/schedule/StudentScheduleUpload";
import StudentSchedulesView from "@/components/schedule/StudentSchedulesView";
import SubjectManagement from "@/components/schedule/SubjectManagement";
import Tabs from "@/components/schedule/Tabs";
import { generateSchedule } from "@/lib/scheduler/generate";
import {
  addSavedSchedule,
  deletedStudentsToView,
  deleteSavedSchedule,
  exportStudentsJson,
  importStudents,
  permanentlyDeleteStudent,
  restoreStudent,
  savedSchedulesToView,
  schedulerFromUi,
  schedulerToUi,
  setScheduler,
  setSubjects,
  softDeleteStudent,
  studentRecordFromView,
  toViewStudents,
  updateStudentRecord,
  upsertStudent,
  type SchedulerUiConfig,
} from "@/lib/vault/operations";
import type { StudentRecord, VaultDocument } from "@/lib/vault/types";
import "@/app/schedule.css";

export function Workspace({
  document,
  onChange,
}: {
  document: VaultDocument;
  onChange: (next: VaultDocument) => void;
}) {
  const [config, setConfig] = useState<SchedulerUiConfig | null>(null);
  const [schedule, setSchedule] = useState<ReturnType<
    typeof generateSchedule
  > | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("students");

  const studentSchedulesData = useMemo(
    () => toViewStudents(document),
    [document],
  );
  const allStudentNames = useMemo(() => {
    const names = new Set(Object.keys(document.students));
    for (const student of document.scheduler.students) {
      if (student.name) {
        names.add(student.name);
      }
    }
    return Array.from(names);
  }, [document]);

  function apply(next: VaultDocument) {
    if (JSON.stringify(next) === JSON.stringify(document)) {
      return;
    }
    onChange(next);
  }

  const tabs = [
    {
      id: "students",
      label: "Students",
      content: (
        <section className="input-section">
          <CreateStudentSchedule
            onStudentCreated={(name: string, record: StudentRecord) => {
              apply(upsertStudent(document, name, record));
            }}
          />

          <StudentScheduleUpload
            onUpload={(payload: Parameters<typeof importStudents>[1], overwrite: boolean) => {
              const result = importStudents(document, payload, overwrite);
              apply(result.document);
              return {
                existing_students: result.existing,
                saved_students: result.saved,
                students: toViewStudents(result.document),
              };
            }}
          />

          <div className="reload-section">
            <button
              type="button"
              className="reload-button"
              onClick={() => {
                const blob = new Blob([exportStudentsJson(document)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const link = window.document.createElement("a");
                link.href = url;
                link.download = "easy-cal-students.json";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download Students JSON
            </button>
          </div>

          <StudentSchedulesView
            students={studentSchedulesData}
            studentNames={allStudentNames}
            onSaveStudent={(
              name: string,
              data: {
                blocked_times: StudentRecord["blockedTimes"];
                can_overlap: string[];
              },
            ) => {
              apply(updateStudentRecord(document, name, studentRecordFromView(data)));
            }}
            onDeleteStudent={(name: string) => {
              apply(softDeleteStudent(document, name));
            }}
          />

          <DeletedStudentsView
            deletedStudents={deletedStudentsToView(document)}
            onRestore={(name: string) => {
              apply(restoreStudent(document, name));
            }}
            onPermanentDelete={(name: string) => {
              apply(permanentlyDeleteStudent(document, name));
            }}
          />
        </section>
      ),
    },
    {
      id: "subjects",
      label: "Subjects",
      content: (
        <section className="input-section">
          <SubjectManagement
            subjects={document.subjects}
            onChange={(subjects: string[]) => {
              apply(setSubjects(document, subjects));
            }}
          />
        </section>
      ),
    },
    {
      id: "scheduler",
      label: "Scheduler",
      content: (
        <>
          <section className="input-section">
            <SchedulerConfiguration
              onConfigChange={(next: SchedulerUiConfig) => {
                setConfig(next);
                apply(setScheduler(document, schedulerFromUi(next)));
              }}
              uploadedStudents={allStudentNames}
              initialConfig={schedulerToUi(document.scheduler)}
              masterSubjects={document.subjects}
            />

            <div className="generate-section">
              <button
                onClick={() => {
                  const active = config ?? schedulerToUi(document.scheduler);
                  if (active.students.length === 0) {
                    setError("Please add at least one student");
                    return;
                  }
                  const invalid = active.students.filter(
                    (student) => !student.name || student.name.trim() === "",
                  );
                  if (invalid.length > 0) {
                    setError("All students must have names");
                    return;
                  }

                  setGenerating(true);
                  setError(null);
                  try {
                    const view = toViewStudents(document);
                    const result = generateSchedule({
                      students: Object.fromEntries(
                        active.students.map((student) => {
                          const record = view[student.name];
                          return [
                            student.name,
                            {
                              blocked_times: record?.blocked_times ?? [],
                              can_overlap: record?.can_overlap ?? [],
                            },
                          ];
                        }),
                      ),
                      student_configs: active.students.map((student) => ({
                        name: student.name,
                        subjects: student.subjects.map((subject) => ({
                          name: subject.name,
                          constraint_type: subject.constraint_type || "weekly",
                          daily_minutes: subject.daily_minutes || null,
                          weekly_days: subject.weekly_days || null,
                          weekly_minutes_per_session:
                            subject.weekly_minutes_per_session || null,
                        })),
                        color: student.color || null,
                      })),
                      working_hours: {
                        days: active.workingHours.days,
                        start_time: active.workingHours.start_time,
                        end_time: active.workingHours.end_time,
                      },
                      lunch_time: active.lunchTime,
                      prep_time_required: active.prepTimeRequired,
                    });
                    setSchedule(result);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Failed to generate schedule",
                    );
                    setSchedule(null);
                  } finally {
                    setGenerating(false);
                  }
                }}
                disabled={
                  generating ||
                  (config ?? schedulerToUi(document.scheduler)).students.length ===
                    0
                }
                className="generate-button"
              >
                {generating ? "Generating Schedule..." : "Generate Schedule"}
              </button>
              {error && <div className="error">{error}</div>}
            </div>
          </section>

          <section className="output-section">
            <SavedSchedulesManager
              scheduleData={schedule}
              savedSchedules={savedSchedulesToView(document)}
              onSave={(name: string, data: unknown) => {
                apply(addSavedSchedule(document, name, data));
              }}
              onLoad={(name: string) => {
                const item = document.savedSchedules.find(
                  (entry) => entry.name === name,
                );
                if (!item) {
                  throw new Error("Schedule not found");
                }
                return item.result;
              }}
              onDelete={(name: string) => {
                apply(deleteSavedSchedule(document, name));
              }}
              onLoadSchedule={(loaded: ReturnType<typeof generateSchedule>) => {
                setSchedule(loaded);
              }}
            />
            {schedule && (
              <ScheduleDisplay
                scheduleData={schedule}
                workingDays={
                  (config ?? schedulerToUi(document.scheduler)).workingHours.days
                }
                studentColors={Object.fromEntries(
                  (config ?? schedulerToUi(document.scheduler)).students.map(
                    (student) => [student.name, student.color || "#87ceeb"],
                  ),
                )}
                studentSchedules={studentSchedulesData}
                config={config ?? schedulerToUi(document.scheduler)}
                onScheduleUpdate={(updated: ReturnType<typeof generateSchedule>) => {
                  setSchedule(updated);
                }}
              />
            )}
          </section>
        </>
      ),
    },
  ];

  return (
    <div className="app">
      <main className="app-main">
        <div className="app-content">
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />
        </div>
      </main>
    </div>
  );
}
