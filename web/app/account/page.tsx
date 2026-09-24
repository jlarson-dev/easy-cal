import { auth } from "@clerk/nextjs/server";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DeleteAccountForm } from "@/components/vault/DeleteAccountForm";

export default async function AccountPage() {
  await auth.protect();
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader locked />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <DeleteAccountForm />
      </main>
      <SiteFooter />
    </div>
  );
}
