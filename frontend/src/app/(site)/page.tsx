import type { HomeData } from "@sgh/shared";
import { GamingGuides, LatestNews } from "@/components/home/article-sections";
import { Community } from "@/components/home/community";
import { CustomRoomsSection } from "@/components/home/custom-rooms-section";
import { FeaturedTournaments } from "@/components/home/featured-tournaments";
import { FinderSection } from "@/components/home/finder-section";
import { GunGuides } from "@/components/home/gun-guides";
import { Hero } from "@/components/home/hero";
import { PopularDevices } from "@/components/home/popular-devices";
import { Resources } from "@/components/home/resources";
import { apiGetOr } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";
import type { RoomCard } from "@/lib/play/types";
import { siteConfig } from "@/lib/site";

export const metadata = buildMetadata({
  title: `${siteConfig.name} — BGMI Tournaments, Sensitivity & Guides`,
  description: siteConfig.description,
  path: "/",
});

const EMPTY_HOME: HomeData = {
  featuredTournaments: [],
  popularDevices: [],
  brands: [],
  weapons: [],
  latestNews: [],
  latestGuides: [],
  resources: [],
};

export const revalidate = 300;

export default async function HomePage() {
  const [home, upcomingRooms, recentRooms] = await Promise.all([
    apiGetOr<HomeData>("/home", EMPTY_HOME, { tags: ["home"], revalidate: 300 }),
    apiGetOr<RoomCard[]>("/rooms", [], { tags: ["rooms"], revalidate: 60, searchParams: { status: "upcoming", limit: 3 } }),
    apiGetOr<RoomCard[]>("/rooms", [], { tags: ["rooms"], revalidate: 300, searchParams: { status: "completed", limit: 3 } }),
  ]);
  return (
    <>
      <Hero />
      <CustomRoomsSection upcoming={upcomingRooms} completed={recentRooms} />
      <FeaturedTournaments tournaments={home.featuredTournaments} />
      <FinderSection brands={home.brands} />
      <PopularDevices devices={home.popularDevices} brands={home.brands} />
      <GunGuides weapons={home.weapons} />
      <LatestNews articles={home.latestNews} />
      <GamingGuides articles={home.latestGuides} />
      <Community />
      <Resources resources={home.resources} />
    </>
  );
}
