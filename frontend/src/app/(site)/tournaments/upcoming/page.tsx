import { makeListingPage } from "@/components/tournaments/listing-page";

const { Page, generateMetadata } = makeListingPage("upcoming", "/tournaments/upcoming");
export { generateMetadata };
export default Page;
