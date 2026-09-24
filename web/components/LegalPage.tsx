import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export function LegalPage({
  title,
  paragraphs,
}: {
  title: string;
  paragraphs: string[];
}) {
  return (
    <div className="flex min-h-full flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-foreground/50">
          Easy Cal
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <div className="mt-8 space-y-4 text-sm leading-7 text-foreground/80">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <p className="mt-10 text-sm">
          <Link href="/" className="text-brand hover:underline">
            Back to Easy Cal
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
