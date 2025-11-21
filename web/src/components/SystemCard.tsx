import React from "react";
import { Link } from "react-router-dom";
import type { SystemMeta } from "../data/systems";
import { getSystemHeroImage } from "../assets/systemHeroImages";

type SystemCardProps = {
  system: SystemMeta;
};

export const SystemCard: React.FC<SystemCardProps> = ({ system }) => {
  const heroUrl = getSystemHeroImage(system.id);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {heroUrl && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-900">
          <img
            src={heroUrl}
            alt={`${system.name} attractor visualization`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {system.name}
          </h3>
          <p className="mt-1 text-xs text-slate-600">{system.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {system.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Link
            to={`/systems/${system.slug}`}
            className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-slate-50 transition hover:bg-slate-800"
          >
            View system page
          </Link>
          <Link
            to={`/?system=${system.id}`}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Open in viewer
          </Link>
        </div>
      </div>
    </article>
  );
};
