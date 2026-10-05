/** Shared API response contracts. Keep server field names in snake_case. */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

export interface Paginated<T> {
  pagination: Pagination;
  [key: string]: T[] | Pagination;
}
