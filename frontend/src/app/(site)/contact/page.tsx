import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/forms/contact-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = buildMetadata({ title: "Contact us", description: "Contact Shivanshi Gaming Hub — questions, corrections, advertising and partnerships.", path: "/contact" });

export default function ContactPage() {
  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
      <h1 className="mt-4 text-display font-bold">Contact us</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 md:p-8"><ContactForm /></Card>
        <aside className="flex flex-col gap-4 text-sm">
          <Card className="p-5">
            <h2 className="font-semibold">Email</h2>
            <p className="mt-1"><a href={`mailto:${siteConfig.contact.email}`} className="text-secondary underline break-all">{siteConfig.contact.email}</a></p>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Report a problem with a page</h2>
            <p className="mt-1 text-muted">Wrong tournament details, copyright or privacy concerns: use the <Link href="/report" className="text-secondary underline">report form</Link> to get a ticket number.</p>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Privacy requests</h2>
            <p className="mt-1 text-muted">Access, correct or delete your data: <Link href="/privacy-request" className="text-secondary underline">privacy request form</Link>.</p>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
