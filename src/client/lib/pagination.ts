export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function isPaginated<T>(response: T[] | PaginatedResponse<T>): response is PaginatedResponse<T> {
  return response && typeof response === 'object' && 'data' in response && 'totalPages' in response;
}
