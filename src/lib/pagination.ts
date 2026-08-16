export const DEFAULT_PAGE_SIZE = 25;
export const SMALL_PAGE_SIZE = 10;

export function parsePage(raw: string | undefined | null, fallback = 1) {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function pageOffset(page: number, pageSize: number) {
  return (page - 1) * pageSize;
}

export function hasNextPage(page: number, pageSize: number, total: number) {
  return page * pageSize < total;
}

export function withPageParam(
  basePath: string,
  page: number,
  extra?: Record<string, string | undefined>
) {
  const params = new URLSearchParams();
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
