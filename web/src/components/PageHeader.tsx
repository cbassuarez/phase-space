import React from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children?: React.ReactNode;
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  children,
}) => {
  return (
    <header className="mb-8 space-y-3">
      {eyebrow && (
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
          {eyebrow}
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--ps-text)] sm:text-3xl">
        {title}
      </h1>
      {subtitle && (
        <p className="max-w-2xl text-sm text-slate-600">{subtitle}</p>
      )}
      {children && <div className="pt-2">{children}</div>}
    </header>
  );
};
