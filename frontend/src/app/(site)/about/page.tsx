import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { JsonLd, organizationLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = buildMetadata({ title: "About Shivanshi Gaming Hub", description: "Who runs Shivanshi Gaming Hub, how we verify tournaments and test sensitivity settings, and how the site is funded.", path: "/about" });

export default function AboutPage() {
  return (
    <Container className="py-10 md:py-16">
      <JsonLd data={organizationLd()} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />
      <article className="mt-6 max-w-3xl">
        <h1 className="text-display font-bold">About Shivanshi Gaming Hub</h1>
        <div className="prose-sgh mt-6">
          <p>Shivanshi Gaming Hub is a free information and community website for BGMI and PUBG Mobile players in India, run by {siteConfig.owner}. We bring together tournament announcements, tested sensitivity settings and practical guides in one place.</p>
          <h2 id="how-we-verify-tournaments">How we verify tournaments</h2>
          <p>We list a tournament only with a link to its official announcement — the organiser&apos;s or publisher&apos;s own post, reel or page. A search result or repost is not a source. Unconfirmed events are clearly labelled as rumours, every listing shows when we last checked it, and prize pools appear only once verified.</p>
          <h2 id="how-we-test">How we test sensitivity settings</h2>
          <p>Settings marked <strong>Tested</strong> were played by a named member of our team on the stated phone, frame rate and game version, in the training ground and in matches. <strong>Community</strong> settings were submitted by players and reviewed by us. <strong>Baseline</strong> settings are a starting point for a class of phones, not tested on your exact model. Sensitivity is personal, so always fine-tune.</p>
          <h2 id="independence">Independence</h2>
          <p>{siteConfig.disclaimer}</p>
          <h2 id="funding">How the site is funded</h2>
          <p>The site is free. It may show labelled advertisements and sponsored content and use affiliate links — see our <Link href="/legal/advertising-disclosure">advertising</Link> and <Link href="/legal/affiliate-disclosure">affiliate</Link> disclosures. We never charge entry fees, run paid contests or promote betting or real-money gaming.</p>
        </div>
        <Card className="mt-10 p-5 text-sm">
          <h2 className="font-semibold">Contact</h2>
          <p className="mt-1 text-muted"><a href={`mailto:${siteConfig.contact.email}`} className="text-secondary underline">{siteConfig.contact.email}</a> · <Link href="/contact" className="text-secondary underline">Contact form</Link> · <Link href="/legal/grievance" className="text-secondary underline">Grievance redressal</Link></p>
        </Card>
      </article>
    </Container>
  );
}
