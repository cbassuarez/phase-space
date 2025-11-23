import React from "react";
import { Link } from "react-router-dom";
import { ContentPageShell } from "../layouts/ContentPageShell";
import { fieldNotes } from "../data/fieldNotes";

export const FieldNotesPage: React.FC = () => {
  return (
    <ContentPageShell kind="prose">
      <header className="pt-4 sm:pt-6 lg:pt-8">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--ps-text-muted)] uppercase">
          Field Notes
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[color:var(--ps-text)]">
          Observations from phase space
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[color:var(--ps-text-soft)] leading-relaxed">
          Short notes on interesting regions, parameter choices, and camera behaviors.
        </p>
      </header>

      <main className="pb-8 sm:pb-10 lg:pb-12">
        <div className="mt-6 space-y-4 sm:space-y-5">
          {fieldNotes.map((note) => (
            <article
              key={note.id}
              className="flex flex-col gap-3 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-4 shadow-[var(--ps-shadow-soft)] sm:flex-row sm:p-5"
            >
              {note.thumbnail && (
                <div className="w-full max-w-[200px] overflow-hidden rounded-xl bg-slate-900 sm:w-48">
                  <img
                    src={note.thumbnail}
                    alt={note.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2 text-sm sm:text-base text-[color:var(--ps-text-soft)]">
                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[color:var(--ps-text-muted)]">
                    {note.system}
                  </div>
                  <h3 className="text-base font-semibold text-[color:var(--ps-text)]">
                    {note.title}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-[color:var(--ps-text-muted)]">{note.summary}</p>
                <p className="line-clamp-3 text-xs sm:text-sm">
                  {note.body}
                </p>
                <div className="mt-auto flex items-center gap-2 pt-1">
                  {note.query && (
                    <Link
                      to={`/?system=${note.query.system ?? note.system}&preset=${note.query.preset ?? ""}`}
                      className="text-xs font-medium text-[color:var(--ps-text)] underline-offset-2 hover:underline"
                    >
                      Open in viewer
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </ContentPageShell>
  );
};
