import { PaginationMetaDto, PaginatedResponseDto } from '../dto/pagination.dto';

export interface PaginationOptions {
  page: number;
  per_page: number;
}

export interface PaginationResult<T> {
  data: T[];
  meta: PaginationMetaDto;
}

export function createPaginationMeta(
  total: number,
  page: number,
  per_page: number,
): PaginationMetaDto {
  const total_pages = Math.ceil(total / per_page);
  
  return {
    total,
    page,
    per_page,
    total_pages,
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  per_page: number,
): PaginatedResponseDto<T> {
  return {
    data,
    meta: createPaginationMeta(total, page, per_page),
  };
}

export function getPaginationSkip(page: number, per_page: number): number {
  return (page - 1) * per_page;
}