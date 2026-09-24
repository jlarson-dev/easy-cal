import { SignUp } from "@clerk/nextjs";
import { SiteFooter } from "@/components/SiteFooter";

export default function SignUpPage() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <SignUp forceRedirectUrl="/app" signInUrl="/sign-in" />
      </div>
      <SiteFooter />
    </div>
  );
}
