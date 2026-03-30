import * as React from "react";

import { cn } from "@/lib/utils";

export type MemberListColumn<T> = {
  /**
   * Unique key for the column.
   * Used for `key` only; not related to table data shape.
   */
  id: string;
  header: React.ReactNode;
  /**
   * Renders the cell content for this column.
   */
  render: (row: T) => React.ReactNode;
  /**
   * CSS grid column width, e.g. "1fr", "120px", "minmax(140px, 1fr)".
   * If omitted, defaults to "1fr".
   */
  width?: string;
  /**
   * Extra classes for the header cell wrapper.
   */
  headerClassName?: string;
  /**
   * Extra classes for each body cell wrapper.
   */
  cellClassName?: string;
};

export type MemberListProps<T> = {
  columns: MemberListColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;

  onRowClick?: (row: T) => void;
  isRowDisabled?: (row: T) => boolean;

  /**
   * Shows a friendly message when `rows` is empty.
   */
  emptyState?: React.ReactNode;

  /**
   * When set, list becomes scrollable and header stays sticky.
   * Example: 420, "60vh"
   */
  maxHeight?: number | string;

  className?: string;
};

export default function MemberList<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  isRowDisabled,
  emptyState,
  maxHeight,
  className,
}: MemberListProps<T>) {
  const gridTemplateColumns = columns
    .map((c) => c.width ?? "1fr")
    .join(" ");

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-border/50 bg-card text-foreground overflow-x-auto",
        className
      )}
    >
      <div
        className={cn(maxHeight ? "overflow-auto" : "")}
        style={maxHeight != null ? { maxHeight } : undefined}
      >
        <div
          className={cn(
            "grid items-center px-6 py-2 text-xs font-semibold text-muted-foreground bg-background/70",
            "border-b border-border/50",
            "sticky top-0 z-10"
          )}
          style={{ gridTemplateColumns }}
        >
          {columns.map((col) => (
            <div
              key={col.id}
              className={cn("truncate", col.headerClassName)}
            >
              {col.header}
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            {emptyState ?? "No results found"}
          </div>
        ) : (
          <div>
            {rows.map((row) => {
              const rowId = getRowId(row);
              const disabled = isRowDisabled?.(row) ?? false;
              const clickable = typeof onRowClick === "function" && !disabled;

              return (
                <div
                  key={rowId}
                  className={cn(
                    "grid items-center px-6 py-3 text-sm",
                    "border-b border-border/50 last:border-b-0",
                    clickable ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""
                  )}
                  style={{ gridTemplateColumns }}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : -1}
                  onClick={() => {
                    if (!clickable) return;
                    onRowClick?.(row);
                  }}
                  onKeyDown={(e) => {
                    if (!clickable) return;
                    if (e.key === "Enter" || e.key === " ") onRowClick?.(row);
                  }}
                >
                  {columns.map((col) => (
                    <div
                      key={col.id}
                      className={cn("min-w-0", col.cellClassName)}
                    >
                      {col.render(row)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

