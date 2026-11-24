import { makeListingPage } from "@/components/tournaments/listing-page";

const { Page, generateMetadata } = makeListingPage("cancelled", "/tournaments/cancelled");
export { generateMetadata };
export default Page;
