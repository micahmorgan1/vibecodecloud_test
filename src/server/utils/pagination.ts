import { Request } from 'express';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export function parsePagination(query: Request['query']): PaginationParams | null {
  if (!query.page) return null;

  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string, 10) || 25));

  return { page, pageSize };
}

export function prismaSkipTake(params: PaginationParams) {
  return {
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
  };
}

export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams) {
  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}
