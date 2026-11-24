import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { UiKitInteractive } from "./interactive";

export const metadata: Metadata = { title: "UI kit", robots: { index: false, follow: false } };

/** Internal component gallery for design QA. Never available in production. */
export default function UiKitPage() {
  if (process.env.SITE_ENV === "production") notFound();

  return (
    <Container className="flex flex-col gap-14 py-12">
      <header className="flex flex-col gap-3">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "UI kit" }]} />
        <h1 className="text-display font-bold">UI kit</h1>
        <p className="text-muted">Design-system components (Milestone M1). Internal page, not indexed.</p>
      </header>

      <section aria-labelledby="buttons" className="flex flex-col gap-4">
        <h2 id="buttons" className="text-2xl font-semibold">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      <section aria-labelledby="badges" className="flex flex-col gap-4">
        <h2 id="badges" className="text-2xl font-semibold">Status badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge tone="warning">Rumour</Badge>
          <Badge tone="success">Confirmed</Badge>
          <Badge tone="accent">Ongoing</Badge>
          <Badge tone="neutral">Completed</Badge>
          <Badge tone="danger">Cancelled</Badge>
          <Badge tone="primary">Tested</Badge>
          <Badge tone="info">Community</Badge>
        </div>
      </section>

      <section aria-labelledby="cards" className="flex flex-col gap-4">
        <h2 id="cards" className="text-2xl font-semibold">Cards</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card interactive>
            <CardHeader>
              <CardTitle>Interactive card</CardTitle>
              <CardDescription>Lifts on hover with a pointer; static on touch.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted">Card body content.</CardContent>
            <CardFooter>
              <Button size="sm" variant="secondary">Action</Button>
            </CardFooter>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="font-mono text-sm text-muted">Mono values: 120 · 95 · 300</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="forms" className="flex max-w-xl flex-col gap-4">
        <h2 id="forms" className="text-2xl font-semibold">Form controls</h2>
        <Field id="kit-name" label="Name" required hint="As you want it shown.">
          {(aria) => <Input {...aria} autoComplete="name" />}
        </Field>
        <Field id="kit-brand" label="Mobile brand">
          {(aria) => (
            <Select {...aria} defaultValue="">
              <option value="" disabled>Select a brand</option>
              <option>iQOO</option>
              <option>POCO</option>
            </Select>
          )}
        </Field>
        <Field id="kit-msg" label="Message" error="Message is required.">
          {(aria) => <Textarea {...aria} />}
        </Field>
      </section>

      <UiKitInteractive />

      <section aria-labelledby="states" className="grid gap-4 md:grid-cols-2">
        <h2 id="states" className="sr-only">States</h2>
        <EmptyState level={3}
          title="No tournaments yet"
          description="Verified tournaments will appear here as soon as they are announced."
          action={<Button variant="secondary" size="sm">Suggest a tournament</Button>}
        />
        <ErrorState level={3}
          title="Couldn't load tournaments"
          description="Please try again in a moment."
          requestId="01JDEMO0000000000000000000"
          action={<Button variant="secondary" size="sm">Retry</Button>}
        />
      </section>
    </Container>
  );
}
