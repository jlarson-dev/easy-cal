import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="bg-brand px-6 py-10 text-center text-white">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/80">
          Easy Cal
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Student Schedule Generator
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-white/90">
          Build weekly tutoring schedules in the browser. Student names and
          availability stay encrypted so only you can read them.
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
        <section className="rounded-lg bg-card p-8">
          <h2 className="text-xl font-semibold">Same scheduler, easier to share</h2>
          <p className="mt-3 leading-7 text-foreground/80">
            Add students, set blocked times, assign subjects, and generate an
            optimized week. Your roster lives in a private vault on your
            account — not a desktop file, and not readable by Easy Cal admins.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {userId ? (
              <Link
                href="/app"
                className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Open your vault
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
                >
                  Create an account
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-md border border-brand px-5 py-2.5 text-sm font-medium text-brand hover:bg-brand/5"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-card p-5">
            <h3 className="font-semibold">Students</h3>
            <p className="mt-2 text-sm leading-6 text-foreground/70">
              Availability, overlap groups, and restore from the deletion log.
            </p>
          </div>
          <div className="rounded-lg bg-card p-5">
            <h3 className="font-semibold">Generate</h3>
            <p className="mt-2 text-sm leading-6 text-foreground/70">
              30-minute slots, lunch, prep, and weekly or daily subject rules.
            </p>
          </div>
          <div className="rounded-lg bg-card p-5">
            <h3 className="font-semibold">Private by design</h3>
            <p className="mt-2 text-sm leading-6 text-foreground/70">
              Encryption happens in your browser. We store ciphertext only.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
