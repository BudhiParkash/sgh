import type { ApiMeta } from "@sgh/shared";

export interface PageParams {
  page: number;
  limit: number;
}

export function toSkip({ page, limit }: PageParams): number {
  return (page - 1) * limit;
}

export function buildMeta({ page, limit }: PageParams, total: number): ApiMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
