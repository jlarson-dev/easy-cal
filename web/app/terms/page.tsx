import { LegalPage } from "@/components/LegalPage";
import { TERMS_COPY } from "@/lib/legal/copy";

export default function TermsPage() {
  return <LegalPage title="Terms of use" paragraphs={TERMS_COPY} />;
}
