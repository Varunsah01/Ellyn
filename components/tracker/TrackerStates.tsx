"use client";

import Link from "next/link";
import { AlertTriangle, ClipboardList, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ErrorStateProps {
  error?: string | null;
  onRetry: () => void;
}

interface NoResultsStateProps {
  searchQuery: string;
  onClearSearch: () => void;
}

interface EmptyStateProps {
  extensionHref?: string;
}

export function LoadingState() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center justify-center py-12">
        <div
          className="h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-b-[#FF7B7B]"
          aria-hidden
        />
        <p className="mt-4 text-sm text-slate-600">Loading contacts...</p>
      </div>
      <TrackerTableSkeleton />
    </div>
  );
}

export function EmptyState({ extensionHref = "https://www.useellyn.com" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-20 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-6 rounded-full bg-[#fff1f1] p-4 dark:bg-[#2a1414]">
        <ClipboardList className="h-16 w-16 text-[#FF7B7B]" aria-hidden />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-100">No contacts yet</h3>
      <p className="mb-6 max-w-md text-sm text-slate-500 dark:text-slate-300">
        Your outreach tracker is empty. Save contacts from LinkedIn with the Ellyn extension to start
        building a consistent pipeline.
      </p>
      <Button
        asChild
        className="bg-[#FF7B7B] text-white hover:bg-[#ff6b6b] focus-visible:ring-2 focus-visible:ring-[#FF7B7B]/40"
      >
        <Link href={extensionHref} target="_blank" rel="noopener noreferrer">
          Get Extension
        </Link>
      </Button>
    </div>
  );
}

export function NoResultsState({ searchQuery, onClearSearch }: NoResultsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
      <SearchX className="mb-4 h-16 w-16 text-slate-300" aria-hidden />
      <h4 className="mb-2 text-lg font-medium text-slate-700 dark:text-slate-100">No contacts found</h4>
      <p className="text-sm text-slate-500 dark:text-slate-300">
        No results for <span className="font-medium text-slate-700">&quot;{searchQuery}&quot;</span>
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Try clearing filters or searching by company, role, or contact name.
      </p>
      <button
        type="button"
        onClick={onClearSearch}
        className="mt-4 text-sm font-medium text-[#FF7B7B] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7B7B]/40 rounded-sm"
      >
        Clear search
      </button>
    </div>
  );
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-20 text-center">
      <AlertTriangle className="mb-4 h-16 w-16 text-rose-400" aria-hidden />
      <h4 className="mb-2 text-lg font-medium text-slate-700">Something went wrong</h4>
      <p className="mb-6 max-w-md text-sm text-slate-500">
        {error || "Unable to load contacts. Please try again."}
      </p>
      <Button
        type="button"
        onClick={onRetry}
        className="bg-[#FF7B7B] text-white hover:bg-[#ff6b6b] focus-visible:ring-2 focus-visible:ring-[#FF7B7B]/40"
      >
        Try Again
      </Button>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <TableRow className="animate-pulse hover:bg-transparent">
      <TableCell className="py-3">
        <div className="h-4 w-8 rounded bg-slate-200" />
      </TableCell>
      <TableCell className="py-3">
        <div className="h-4 w-32 rounded bg-slate-200" />
      </TableCell>
      <TableCell className="py-3">
        <div className="h-4 w-28 rounded bg-slate-200" />
      </TableCell>
      <TableCell className="py-3">
        <div className="h-4 w-36 rounded bg-slate-200" />
      </TableCell>
      <TableCell className="py-3">
        <div className="h-4 w-40 rounded bg-slate-200" />
      </TableCell>
      <TableCell className="py-3">
        <div className="h-6 w-48 rounded-full bg-slate-200" />
      </TableCell>
      <TableCell className="py-3">
        <div className="h-8 w-20 rounded bg-slate-200" />
      </TableCell>
      <TableCell className="py-3">
        <div className="h-8 w-8 rounded bg-slate-200" />
      </TableCell>
      <TableCell className="py-3">
        <div className="h-8 w-8 rounded bg-slate-200" />
      </TableCell>
    </TableRow>
  );
}

export function TrackerTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader className="bg-[#F5F5F5]">
          <TableRow className="hover:bg-[#F5F5F5]">
            <TableHead className="w-20">sr.no</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Email id</TableHead>
            <TableHead>Mail Status</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Edit</TableHead>
            <TableHead>Menu</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </TableBody>
      </Table>
    </div>
  );
}
