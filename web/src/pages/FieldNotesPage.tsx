import React from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Section } from "../components/Section";
import { fieldNotes } from "../data/fieldNotes";

export const FieldNotesPage: React.FC = () => {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Field Notes"
        title="Observations from phase space"
        subtitle="Short notes on interesting regions, parameter choices, and camera behaviors."
      />

      <Section title="Notes">
        <div className="space-y-4">
          {fieldNotes.map((note) => (
            <article
              key={note.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"
            >
              {note.thumbnail && (
                <div className="w-full max-w-[180px] overflow-hidden rounded-xl bg-slate-900 sm:w-48">
                  <img
                    src={note.thumbnail}
                    alt={note.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2">
                <div>
                  <div className="text-xs font-mono uppercase tracking-[0.18em] text-slate-500">
                    {note.system}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {note.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-600">{note.summary}</p>
                <p className="text-xs text-slate-600 line-clamp-3">
                  {note.body}
                </p>
                <div className="mt-auto flex items-center gap-2 pt-1">
                  {note.query && (
                    <Link
                      to={`/?system=${note.query.system ?? note.system}&preset=${note.query.preset ?? ""}`}
                      className="text-xs font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      Open in viewer
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
};
