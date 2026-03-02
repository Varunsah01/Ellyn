"use client";

import { ReactNode } from "react";

import { Button } from "@/components/ui/Button";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#D9D6EE] bg-[#FAFAFA] px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm text-[#2D2B55]">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[#2D2B55]">{title}</h3>
      <p className="mt-1 max-w-xl text-sm text-slate-600">{description}</p>
      {action ? (
        <Button
          type="button"
          className="mt-4"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
