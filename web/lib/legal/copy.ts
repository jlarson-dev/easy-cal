export const HEALTH_PAYLOAD = { ok: true as const };

export const PRIVACY_COPY = [
  "Easy Cal uses zero-knowledge storage for student schedules. Encryption happens in your browser. We store ciphertext only and cannot read student names, availability, or generated calendars.",
  "We do not sell student data. We do not train models on vault contents — we cannot read them.",
  "Your Clerk account identifies you (email and user id). Student content stays in the encrypted vault until you unlock it on your device.",
  "You can export student JSON after unlock, and you can delete your account, which removes the stored ciphertext. We cannot recover that ciphertext afterward.",
];

export const TERMS_COPY = [
  "Easy Cal cannot reset or recover student data. There is no recovery if you lose both your vault passphrase and recovery key (and have not registered a device passkey that can unwrap the vault).",
  "Downloaded JSON, CSV, PNG, and PDF files are plaintext on your computer after you unlock the vault. You are responsible for those copies.",
  "The service is for an individual tutor using a personal account. Sharing a vault across a school or team is not supported.",
  "Deleting your account deletes the encrypted vault from our servers. We cannot reconstruct student records from backups of ciphertext we cannot decrypt.",
];

export const ACCOUNT_DELETE_COPY = {
  warning:
    "Deleting your account removes the encrypted vault ciphertext from Easy Cal. Student schedules cannot be recovered afterward, including by us.",
  confirmLabel: "Delete my account and vault",
};
