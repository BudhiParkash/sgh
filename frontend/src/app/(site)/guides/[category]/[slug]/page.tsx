import { makeArticlePage } from "@/components/articles/article-pages";

export const revalidate = 3600;
const { Page, generateMetadata } = makeArticlePage("guide");
export { generateMetadata };
export default Page;
