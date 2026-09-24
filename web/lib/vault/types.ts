export const MIN_PASSPHRASE_LENGTH = 12;
export const CRYPTO_VERSION = 1;
export const SCHEMA_VERSION = 1;

export const DEFAULT_SUBJECTS = [
  "Math",
  "Language",
  "Writing",
  "Reading",
  "Science",
];

export const KDF_PARAMS = {
  algorithm: "argon2id" as const,
  memorySize: 19456,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
};

export type BlockedTime = {
  day: string;
  start: string;
  end: string;
  label: string | null;
};

export type StudentRecord = {
  blockedTimes: BlockedTime[];
  canOverlap: string[];
};

export type VaultDocument = {
  schemaVersion: 1;
  subjects: string[];
  students: Record<string, StudentRecord>;
  deletedStudents: Record<
    string,
    {
      deletedAt: string;
      blockedTimes: BlockedTime[];
      canOverlap: string[];
    }
  >;
  scheduler: {
    workingHours: {
      days: string[];
      startTime: string;
      endTime: string;
    };
    lunchTime: string;
    prepTimeRequired: boolean;
    students: Array<{
      name: string;
      color: string | null;
      subjects: Array<{
        name: string;
        constraintType: "daily" | "weekly";
        dailyMinutes: number | null;
        weeklyDays: number | null;
        weeklyMinutesPerSession: number | null;
      }>;
    }>;
  };
  savedSchedules: Array<{
    id: string;
    name: string;
    savedAt: string;
    result: unknown;
  }>;
};

export type WrappedDek = {
  kind: "passphrase" | "recovery" | "prf";
  saltB64: string;
  ivB64: string;
  wrappedDekB64: string;
  credentialIdB64?: string;
};

export type EncryptedVault = {
  schemaVersion: 1;
  cryptoVersion: number;
  kdfParams: typeof KDF_PARAMS;
  wrappedDeks: WrappedDek[];
  ciphertextB64: string;
  nonceB64: string;
  revision?: number;
  updatedAt?: string;
};

export type UnlockSecret =
  | { kind: "passphrase" | "recovery"; secret: string }
  | { kind: "prf"; prfOutput: Uint8Array };
