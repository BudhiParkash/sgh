import type { TournamentDetail } from "@sgh/shared";
import { siteConfig } from "@/lib/site";
import { absoluteUrl } from "./metadata";

type Json = Record<string, unknown>;

/** Renders JSON-LD safely (escapes "<" so content can't break out of the script tag). */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function organizationLd(): Json {
  const sameAs = Object.values(siteConfig.socials).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl("/icon.svg"),
    founder: { "@type": "Person", name: siteConfig.owner },
    ...(sameAs.length && { sameAs }),
  };
}

export function websiteLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    url: siteConfig.url,
    name: siteConfig.name,
    inLanguage: "en-IN",
    publisher: { "@id": `${siteConfig.url}/#organization` },
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${siteConfig.url}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

/**
 * Event markup ONLY for verified events with a confirmed start date and organiser (docs/architecture/08 §3).
 * Rumours get no Event markup; no `offers` (there is never an entry fee).
 */
export function tournamentEventLd(t: TournamentDetail): Json | null {
  if (t.status === "rumour" || !t.startDate || !t.lastVerifiedAt) return null;
  const statusMap: Record<string, string> = {
    confirmed: "https://schema.org/EventScheduled",
    ongoing: "https://schema.org/EventScheduled",
    completed: "https://schema.org/EventScheduled",
    cancelled: "https://schema.org/EventCancelled",
  };
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: t.name,
    description: t.seo.description ?? undefined,
    startDate: t.startDate,
    ...(t.endDate && { endDate: t.endDate }),
    eventStatus: statusMap[t.status],
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", url: t.officialSourceUrl },
    organizer: { "@type": "Organization", name: t.organiser },
    url: absoluteUrl(`/tournaments/${t.slug}`),
    ...(t.featuredImage && { image: [t.featuredImage.url] }),
  };
}
