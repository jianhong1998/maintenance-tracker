export type PageContext<Props = object, SearchParams = object> = {
  params: Promise<Props>;
  searchParams: Promise<SearchParams>;
};
