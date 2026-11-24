import { makeListingPage } from "@/components/tournaments/listing-page";

const { Page, generateMetadata } = makeListingPage("completed", "/tournaments/completed");
export { generateMetadata };
export default Page;
