import { systems, type SystemId } from "../data/systems";

const heroImages = import.meta.glob("/docs/media/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const systemIds = systems.map((system) => system.id) as SystemId[];

type HeroEntry = { url: string; path: string };

const systemHeroImages: Partial<Record<SystemId, HeroEntry>> = {};

function shouldReplace(existing: HeroEntry, candidate: HeroEntry): boolean {
  const existingLower = existing.path.toLowerCase();
  const candidateLower = candidate.path.toLowerCase();

  const existingIsHero = existingLower.includes("-hero");
  const candidateIsHero = candidateLower.includes("-hero");

  if (candidateIsHero && !existingIsHero) {
    return true;
  }

  if (candidateIsHero === existingIsHero) {
    return candidate.path.length < existing.path.length;
  }

  return false;
}

for (const [path, url] of Object.entries(heroImages)) {
  const lowerPath = path.toLowerCase();
  const candidate: HeroEntry = { path, url };

  for (const slug of systemIds) {
    if (!lowerPath.includes(slug.toLowerCase())) {
      continue;
    }

    const existing = systemHeroImages[slug];
    if (!existing || shouldReplace(existing, candidate)) {
      systemHeroImages[slug] = candidate;
    }
  }
}

export function getSystemHeroImage(systemId: SystemId): string | undefined {
  return systemHeroImages[systemId]?.url;
}
