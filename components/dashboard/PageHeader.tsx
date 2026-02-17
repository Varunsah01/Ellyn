import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * Render the PageHeader component.
 * @param {PageHeaderProps} props - Component props.
 * @returns {unknown} JSX output for PageHeader.
 * @example
 * <PageHeader />
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-fraunces font-bold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-2 font-dm-sans">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
