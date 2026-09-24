import { LegalPage } from "@/components/LegalPage";
import { PRIVACY_COPY } from "@/lib/legal/copy";

export default function PrivacyPolicyPage() {
  return <LegalPage title="Privacy policy" paragraphs={PRIVACY_COPY} />;
}
