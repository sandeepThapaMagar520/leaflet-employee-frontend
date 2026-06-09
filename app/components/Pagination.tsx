"use client";

type PaginationProps = {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({ page, totalPages, totalElements, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 mt-4 text-sm text-muted">
      <span>{totalElements} total · page {page + 1} of {totalPages}</span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          style={{ padding: "6px 12px", fontSize: "0.85rem" }}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          style={{ padding: "6px 12px", fontSize: "0.85rem" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
