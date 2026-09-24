import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-black/10 px-6 py-6 text-center text-sm text-foreground/60">
      <Link href="/privacy" className="hover:text-foreground">
        Privacy
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href="/terms" className="hover:text-foreground">
        Terms
      </Link>
    </footer>
  );
}
