/** Read every public token page; never turn a later-page failure into partial XML. */
export async function allSitemapTokens(
  readPage: (offset: number, end: number) => PromiseLike<{
    data: { address: string }[] | null;
    error: unknown;
  }>,
  pageSize = 1000,
): Promise<{ address: string }[]> {
  const rows: { address: string }[] = [];
  for (let offset = 0; ; ) {
    const { data, error } = await readPage(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data) throw new Error("Token sitemap query returned no data");
    if (data.length === 0) return rows;
    rows.push(...data);
    offset += data.length;
  }
}