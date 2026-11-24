import { makeListingPage } from "@/components/tournaments/listing-page";

const { Page, generateMetadata } = makeListingPage("ongoing", "/tournaments/ongoing");
export { generateMetadata };
export default Page;
