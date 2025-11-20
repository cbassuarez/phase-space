import React from "react";

type SectionProps = {
  id?: string;
  title: string;
  children: React.ReactNode;
  description?: string;
};

export const Section: React.FC<SectionProps> = ({
  id,
  title,
  description,
  children,
}) => {
  return (
    <section id={id} className="mb-10 scroll-mt-24">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h2>
      {description && (
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          {description}
        </p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
};
