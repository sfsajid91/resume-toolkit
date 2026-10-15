import type { Application } from "./schema.ts";

export type ResumeSectionKind = Application["resume"]["sections"][number]["kind"];

export type ResolvedResume = {
  readonly basics: {
    readonly name: string;
    readonly email?: string;
    readonly phone?: string;
    readonly location?: string;
    readonly links: readonly { readonly label: string; readonly url: string }[];
  };
  readonly summary: readonly string[];
  readonly sections: readonly {
    readonly kind: ResumeSectionKind;
    readonly title: string;
    readonly entries: readonly {
      readonly name: string;
      readonly title?: string;
      readonly issuer?: string;
      readonly dateRange: string;
      readonly url?: string;
      readonly bullets: readonly string[];
    }[];
  }[];
  readonly skills: readonly string[];
};

const SECTION_TITLES: Record<ResumeSectionKind, string> = {
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
};

export function resolveResume(application: Application): ResolvedResume {
  const { basics, summary, sections, skills } = application.resume;
  return {
    basics: {
      name: basics.name,
      ...(basics.email === undefined ? {} : { email: basics.email }),
      ...(basics.phone === undefined ? {} : { phone: basics.phone }),
      ...(basics.location === undefined ? {} : { location: basics.location }),
      links: basics.links.map(({ label, url }) => ({ label, url })),
    },
    summary: summary.map(({ text }) => text),
    sections: sections.map(({ kind, items }) => ({
      kind,
      title: SECTION_TITLES[kind],
      entries: items.map(({ name, title, issuer, start, end, url, bullets }) => ({
        name,
        ...(title === undefined ? {} : { title }),
        ...(issuer === undefined ? {} : { issuer }),
        dateRange: [start, end === null ? "Present" : end].filter((value) => value !== undefined).join(" – "),
        ...(url === undefined ? {} : { url }),
        bullets: bullets.map(({ text }) => text),
      })),
    })),
    skills: skills.map(({ label }) => label),
  };
}
