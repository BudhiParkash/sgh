import { makeListingPage } from "@/components/tournaments/listing-page";

const { Page, generateMetadata } = makeListingPage("rumour", "/tournaments/rumours");
export { generateMetadata };
export default Page;
