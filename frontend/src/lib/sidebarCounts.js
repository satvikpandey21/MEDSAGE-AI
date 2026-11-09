export async function countLowStockRows(fetchPage) {
  let total = 0, offset = 0;
  for (;;) {
    const rows = await fetchPage(offset);
    if (!Array.isArray(rows)) throw new Error("Invalid stock response");
    if (rows.length === 0) return total;
    total += rows.filter((row) => row.stock_quantity != null &&
      Number(row.stock_quantity) <= Number(row.low_stock_threshold ?? 5)).length;
    // Respect installations with a row cap smaller than the requested page size.
    offset += rows.length;
  }
}
