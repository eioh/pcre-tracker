import * as React from "react";
import { cn } from "../../lib/utils";

// テーブル要素を共通スタイルで描画する。
const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(function Table(
  { className, ...props },
  ref,
) {
  return <table ref={ref} className={cn("w-full min-w-[1280px] border-collapse", className)} {...props} />;
});
Table.displayName = "Table";

// テーブルヘッダー領域を描画する。
const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(function TableHeader(
  { className, ...props },
  ref,
) {
  return <thead ref={ref} className={cn(className)} {...props} />;
});
TableHeader.displayName = "TableHeader";

// テーブルボディ領域を描画する。
const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(function TableBody(
  { className, ...props },
  ref,
) {
  return <tbody ref={ref} className={cn(className)} {...props} />;
});
TableBody.displayName = "TableBody";

// テーブル行を描画する。
const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(function TableRow(
  { className, ...props },
  ref,
) {
  return <tr ref={ref} className={cn(className)} {...props} />;
});
TableRow.displayName = "TableRow";

// ヘッダーセルを描画する。
const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(function TableHead(
  { className, ...props },
  ref,
) {
  return (
    <th
      ref={ref}
      className={cn(
        "sticky top-0 z-[1] whitespace-nowrap border-b border-[#7a94c533] bg-[#101825f5] px-3 py-2.5 align-middle text-xs tracking-[0.04em] text-[#c8d8f6]",
        className,
      )}
      {...props}
    />
  );
});
TableHead.displayName = "TableHead";

// データセルを描画する。
const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(function TableCell(
  { className, ...props },
  ref,
) {
  return <td ref={ref} className={cn("border-b border-[#7a94c533] px-3 py-2.5 align-middle", className)} {...props} />;
});
TableCell.displayName = "TableCell";

// テーブル説明文を表示する。
const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(function TableCaption(
  { className, ...props },
  ref,
) {
  return <caption ref={ref} className={cn("mt-3 text-sm text-muted", className)} {...props} />;
});
TableCaption.displayName = "TableCaption";

export { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow };
