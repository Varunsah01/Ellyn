import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Render the Table component.
 * @param {React.HTMLAttributes<HTMLTableElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <Table />
 */
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

/**
 * Render the TableHeader component.
 * @param {React.HTMLAttributes<HTMLTableSectionElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <TableHeader />
 */
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

/**
 * Render the TableBody component.
 * @param {React.HTMLAttributes<HTMLTableSectionElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <TableBody />
 */
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

/**
 * Render the TableFooter component.
 * @param {React.HTMLAttributes<HTMLTableSectionElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <TableFooter />
 */
const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

/**
 * Render the TableRow component.
 * @param {React.HTMLAttributes<HTMLTableRowElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <TableRow />
 */
const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

/**
 * Render the TableHead component.
 * @param {React.ThHTMLAttributes<HTMLTableCellElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <TableHead />
 */
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

/**
 * Render the TableCell component.
 * @param {React.TdHTMLAttributes<HTMLTableCellElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <TableCell />
 */
const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

/**
 * Render the TableCaption component.
 * @param {React.HTMLAttributes<HTMLTableCaptionElement>} props - Component props.
 * @returns {JSX.Element} JSX output.
 * @example
 * <TableCaption />
 */
const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
