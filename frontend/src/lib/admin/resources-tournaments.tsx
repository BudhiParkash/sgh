import { TournamentVerificationPanel } from "@/components/admin/panels/tournament-verification";
import { Badge } from "@/components/ui/badge";
import { isoToDateInput, isoToLocalInput, type ResourceDef } from "./resource";
import { seoSection } from "./sections";

/* eslint-disable @typescript-eslint/no-explicit-any -- admin documents */
type Row = Record<string, any>;
const idOf = (v: any) => (v && typeof v === "object" ? (v.id ?? v._id) : v) ?? null;

const STATUS = [
  { value: "rumour", label: "Rumour (unconfirmed)" },
  { value: "confirmed", label: "Confirmed (needs official source + verification)" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
const tone: Record<string, "warning" | "success" | "accent" | "neutral" | "danger"> = { rumour: "warning", confirmed: "success", ongoing: "accent", completed: "neutral", cancelled: "danger" };

export const tournaments: ResourceDef<Row> = {
  key: "tournaments",
  title: "Tournaments",
  singular: "Tournament",
  endpoint: "/tournaments",
  perm: "tournament",
  workflow: true,
  revisions: true,
  description: "Every tournament needs its official announcement link. Rumours are labelled; confirmed events require verification.",
  filters: [{ name: "tstatus", label: "Event status", options: STATUS.map((s) => ({ value: s.value, label: s.value[0]!.toUpperCase() + s.value.slice(1) })) }],
  columns: [
    { key: "name", label: "Name" },
    { key: "game", label: "Game", render: (r) => r.game?.name ?? "—" },
    { key: "status", label: "Event", render: (r) => <Badge tone={tone[r.status] ?? "neutral"} className="capitalize">{r.status}</Badge> },
    { key: "startDate", label: "Starts", render: (r) => (r.startDate ? new Date(r.startDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—") },
    { key: "verification", label: "Verified", render: (r) => (r.verification?.lastVerifiedAt ? new Date(r.verification.lastVerifiedAt).toLocaleDateString("en-IN") : <span className="text-warning">No</span>) },
  ],
  sections: [
    {
      title: "Details",
      fields: [
        { name: "name", label: "Tournament name", type: "text", required: true, max: 140 },
        { name: "game", label: "Game", type: "reference", endpoint: "/games", labelKey: "name", required: true },
        { name: "organiser", label: "Organiser", type: "text", required: true, max: 120 },
        { name: "organiserUrl", label: "Organiser website / profile", type: "url" },
        { name: "status", label: "Event status", type: "select", required: true, options: STATUS, hint: "Ongoing/completed are also derived automatically from the dates for confirmed events." },
        { name: "slug", label: "URL slug", type: "slug" },
        { name: "isFeatured", label: "Feature on the homepage", type: "checkbox" },
      ],
    },
    {
      title: "Dates & prize",
      fields: [
        { name: "startDate", label: "Start (IST)", type: "datetime", hint: "Leave empty if not announced — never guess." },
        { name: "endDate", label: "End (IST)", type: "datetime" },
        { name: "registrationDeadline", label: "Registration closes (IST)", type: "datetime" },
        { name: "prizePool.amount", label: "Prize pool (₹)", type: "number", min: 0 },
        { name: "prizePool.display", label: "Prize pool as announced (text)", type: "text", max: 80, placeholder: "e.g. ₹5,00,000 + trophies" },
        { name: "prizePool.verified", label: "Prize pool verified against an official source (only then it is shown)", type: "checkbox" },
      ],
    },
    {
      title: "Eligibility & format",
      fields: [
        { name: "eligibility.summary", label: "Eligibility (one line)", type: "text", max: 160, placeholder: "e.g. Indian players, 16+, squads of 4" },
        { name: "eligibility.minAge", label: "Minimum age", type: "number", min: 0, max: 99 },
        { name: "eligibility.region", label: "Region", type: "text", max: 120 },
        { name: "eligibility.notes", label: "Eligibility notes", type: "textarea", max: 600 },
        { name: "format", label: "Format", type: "richtext" },
      ],
    },
    {
      title: "Sources & links",
      fields: [
        { name: "officialSourceUrl", label: "Official announcement URL", type: "url", required: true, wide: true, hint: "The organiser's or KRAFTON's own post, reel or page." },
        { name: "registrationUrl", label: "Official registration URL", type: "url", wide: true },
        {
          name: "sources",
          label: "Sources",
          type: "list",
          addLabel: "Add source",
          max: 20,
          hint: "At least one 'Official' source is required before the event can be confirmed.",
          itemFields: [
            { name: "url", label: "URL", type: "url", required: true },
            { name: "type", label: "Type", type: "select", required: true, options: [{ value: "official", label: "Official (organiser / publisher)" }, { value: "organiser_social", label: "Organiser social post" }, { value: "news", label: "News report" }, { value: "community", label: "Community post" }] },
            { name: "title", label: "Title", type: "text", required: true, max: 200 },
            { name: "publisher", label: "Publisher", type: "text", max: 120 },
            { name: "accessedAt", label: "Accessed on", type: "date" },
            { name: "notes", label: "Notes", type: "text", max: 300 },
          ],
        },
      ],
    },
    {
      title: "Content",
      fields: [
        { name: "description", label: "Description", type: "richtext", required: true },
        { name: "featuredImage", label: "Featured image", type: "media", category: "tournament" },
      ],
    },
    seoSection as never,
  ],
  defaults: { status: "rumour", isFeatured: false, sources: [], prizePool: { verified: false }, seo: { robots: { index: true, follow: true } } },
  toForm: (d) => ({
    ...d,
    game: idOf(d.game),
    featuredImage: idOf(d.featuredImage),
    startDate: isoToLocalInput(d.startDate),
    endDate: isoToLocalInput(d.endDate),
    registrationDeadline: isoToLocalInput(d.registrationDeadline),
    sources: (d.sources ?? []).map((s: Row) => ({ ...s, accessedAt: isoToDateInput(s.accessedAt) })),
    seo: { ...(d.seo ?? {}), ogImage: idOf(d.seo?.ogImage), robots: d.seo?.robots ?? { index: true, follow: true } },
  }),
  fromForm: (v) => ({ ...v, sources: ((v.sources as Row[] | undefined) ?? []).map(({ _id, ...s }: Row) => ({ ...s, ...(_id ? { _id } : {}) })) }),
  titleOf: (r) => r.name,
  publicUrl: (r) => `/tournaments/${r.slug}`,
  sidePanel: (doc, onChanged) => <TournamentVerificationPanel doc={doc} onChanged={onChanged} />,
};
