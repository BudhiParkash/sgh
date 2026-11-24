import { makeSectionIndex } from "@/components/articles/article-pages";

export const revalidate = 300;
const { Page, generateMetadata } = makeSectionIndex("guide");
export { generateMetadata };
export default Page;
