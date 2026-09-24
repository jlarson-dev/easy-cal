import { SignIn } from "@clerk/nextjs";
import { SiteFooter } from "@/components/SiteFooter";

export default function SignInPage() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <SignIn forceRedirectUrl="/app" signUpUrl="/sign-up" />
      </div>
      <SiteFooter />
    </div>
  );
}
