import { makeSectionIndex } from "@/components/articles/article-pages";

export const revalidate = 300;
const { Page, generateMetadata } = makeSectionIndex("news");
export { generateMetadata };
export default Page;
