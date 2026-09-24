import { auth } from "@clerk/nextjs/server";
import { VaultGate } from "@/components/vault/VaultGate";

export default async function AppPage() {
  await auth.protect();
  return <VaultGate />;
}
