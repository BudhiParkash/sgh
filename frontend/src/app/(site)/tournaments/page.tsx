import { makeListingPage } from "@/components/tournaments/listing-page";

const { Page, generateMetadata } = makeListingPage("upcoming", "/tournaments", "BGMI & PUBG Mobile tournaments");
export { generateMetadata };
export default Page;
