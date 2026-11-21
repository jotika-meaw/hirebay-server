// Pagination math shared by list endpoints: page ≥ 1, limit clamped to
// 1–24 with a default of 9, at least one page. Callers slice with skip/limit.
export function paginate({ page, limit, total }) {
  const safeLimit = Math.min(24, Math.max(1, Number.parseInt(limit, 10) || 9));
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const pages = Math.max(1, Math.ceil((Number(total) || 0) / safeLimit));
  return { page: safePage, limit: safeLimit, pages, skip: (safePage - 1) * safeLimit };
}
