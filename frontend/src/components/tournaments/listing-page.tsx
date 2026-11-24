import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { STATUS_TABS, TournamentListing, type ListingParams, type ListingStatus } from "./listing";

const TITLES: Record<ListingStatus, string> = {
  upcoming: "Upcoming BGMI & PUBG Mobile tournaments",
  ongoing: "Ongoing BGMI & PUBG Mobile tournaments",
  completed: "Completed tournaments",
  cancelled: "Cancelled tournaments",
  rumour: "Tournament rumours (unconfirmed)",
};

export function listingMetadata(status: ListingStatus, path: string, params: ListingParams): Metadata {
  const page = Number(params.page) || 1;
  const filtered = Boolean(params.game || params.q);
  const tab = STATUS_TABS.find((t) => t.status === status)!;
  return buildMetadata({
    title: page > 1 ? `${TITLES[status]} — page ${page}` : TITLES[status],
    description: `${tab.blurb} Free information only — no entry fees, no betting.`,
    path: page > 1 ? `${path}?page=${page}` : path,
    // Filtered/search variants are thin duplicates → noindex,follow. Rumours are not promoted in search.
    noindex: filtered || status === "rumour" || status === "cancelled",
  });
}

export function makeListingPage(status: ListingStatus, path: string, heading = TITLES[status]) {
  async function Page({ searchParams }: { searchParams: Promise<ListingParams> }) {
    return <TournamentListing status={status} params={await searchParams} basePath={path} heading={heading} />;
  }
  async function generateMetadata({ searchParams }: { searchParams: Promise<ListingParams> }): Promise<Metadata> {
    return listingMetadata(status, path, await searchParams);
  }
  return { Page, generateMetadata };
}
