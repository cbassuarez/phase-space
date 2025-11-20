import React from "react";
import { PageHeader } from "../components/PageHeader";
import { Section } from "../components/Section";
import { systems } from "../data/systems";
import { SystemCard } from "../components/SystemCard";

export const SystemsIndexPage: React.FC = () => {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Systems"
        title="Systems inside Phase Space"
        subtitle="A small field guide to the chaotic dynamical systems you can explore."
      />
      <Section title="Catalog">
        <div className="grid gap-4 sm:grid-cols-2">
          {systems.map((system) => (
            <SystemCard key={system.id} system={system} />
          ))}
        </div>
      </Section>
    </div>
  );
};
