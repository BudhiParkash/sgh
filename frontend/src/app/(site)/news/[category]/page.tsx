import { makeCategoryPage } from "@/components/articles/article-pages";

export const revalidate = 300;
const { Page, generateMetadata } = makeCategoryPage("news");
export { generateMetadata };
export default Page;
