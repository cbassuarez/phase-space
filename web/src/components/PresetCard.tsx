import React from "react";
import { Link } from "react-router-dom";
import type { Preset } from "../data/presets";

type PresetCardProps = {
  preset: Preset;
};

export const PresetCard: React.FC<PresetCardProps> = ({ preset }) => {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {preset.thumbnail && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-900">
          <img
            src={preset.thumbnail}
            alt={preset.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {preset.name}
            </h3>
            <p className="mt-1 text-xs text-slate-500 uppercase tracking-[0.18em]">
              {preset.system}
            </p>
          </div>
          {preset.cameraMode && (
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-50">
              {preset.cameraMode}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-600">{preset.description}</p>
        <div className="flex flex-wrap gap-1">
          {preset.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-auto pt-2">
          <Link
            to={`/?system=${preset.query.system ?? preset.system}&preset=${preset.query.preset ?? preset.id}`}
            className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-slate-50 transition hover:bg-slate-800"
          >
            Open in viewer
          </Link>
        </div>
      </div>
    </article>
  );
};
