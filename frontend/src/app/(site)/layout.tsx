import { ConsentManager } from "@/components/consent/consent-manager";
import { ServiceWorkerRegister } from "@/components/retention/install-app";
import { WebVitals } from "@/components/consent/web-vitals";
import { JsonLd, organizationLd, websiteLd } from "@/lib/seo/jsonld";
import type { Metadata } from "next";

interface PublicSettingsLite {
  analytics?: { ga4Id: string | null; gscVerification: string | null; bingVerification: string | null };
}
const loadSettings = () => apiGetOr<PublicSettingsLite | null>("/settings", null, { tags: ["settings"], revalidate: 600 });

/** Search Console / Bing verification tags from admin Settings. */
export async function generateMetadata(): Promise<Metadata> {
  const s = await loadSettings();
  return {
    verification: {
      ...(s?.analytics?.gscVerification && { google: s.analytics.gscVerification }),
      ...(s?.analytics?.bingVerification && { other: { "msvalidate.01": s.analytics.bingVerification } }),
    },
  };
}
import { Footer } from "@/components/layout/footer";
import { apiGetOr } from "@/lib/api/server";
import { Header } from "@/components/layout/header";
import { SkipLink } from "@/components/layout/skip-link";
import { RevealObserver } from "@/components/motion/reveal-observer";
import { SmoothScroll } from "@/components/motion/smooth-scroll";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await loadSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={[organizationLd(), websiteLd()]} />
      <SkipLink />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />
      <RevealObserver />
      <SmoothScroll />
      <ServiceWorkerRegister />
      <WebVitals />
      <ConsentManager ga4Id={settings?.analytics?.ga4Id ?? null} />
    </div>
  );
}
