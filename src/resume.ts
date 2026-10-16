import type { Application } from "./schema.ts";

export type ResumeSectionKind = Application["resume"]["sections"][number]["kind"];

export type ResolvedResume = {
  readonly basics: {
    readonly name: string;
    readonly headline?: string;
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
      readonly urlDisplay?: string;
      readonly bullets: readonly string[];
    }[];
  }[];
  readonly skills: readonly {
    readonly category?: string;
    readonly labels: readonly string[];
  }[];
};

const SECTION_TITLES: Record<ResumeSectionKind, string> = {
  experience: "PROFESSIONAL EXPERIENCE",
  projects: "SELECTED PROJECTS",
  education: "EDUCATION",
  certifications: "CERTIFICATIONS",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})$/u.exec(value);
  if (match === null) return value;
  const month = Number(match[2]);
  const name = MONTH_NAMES[month - 1];
  return name === undefined ? value : `${name} ${match[1]}`;
}

export function displayUrl(url: string): string {
  return url.replace(/^https:\/\//iu, "");
}

function groupSkills(skills: Application["resume"]["skills"]): ResolvedResume["skills"] {
  const groups = new Map<string | undefined, string[]>();
  for (const skill of skills) {
    let labels = groups.get(skill.category);
    if (labels === undefined) {
      labels = [];
      groups.set(skill.category, labels);
    }
    labels.push(skill.label);
  }
  return [...groups].map(([category, labels]) => ({
    ...(category === undefined ? {} : { category }),
    labels,
  }));
}

export function resolveResume(application: Application): ResolvedResume {
  const { basics, summary, sections, skills } = application.resume;
  return {
    basics: {
      name: basics.name.toUpperCase(),
      ...(basics.headline === undefined ? {} : { headline: basics.headline }),
      ...(basics.email === undefined ? {} : { email: basics.email }),
      ...(basics.phone === undefined ? {} : { phone: basics.phone }),
      ...(basics.location === undefined ? {} : { location: basics.location }),
      links: basics.links.map(({ label, url }) => ({ label: displayUrl(label), url })),
    },
    summary: summary.map(({ text }) => text),
    sections: sections.map(({ kind, items }) => ({
      kind,
      title: SECTION_TITLES[kind],
      entries: items.map(({ name, title, issuer, start, end, url, bullets }) => ({
        name,
        ...(title === undefined ? {} : { title }),
        ...(issuer === undefined ? {} : { issuer }),
        dateRange: [
          start === undefined ? undefined : formatDate(start),
          end === null ? "Present" : end === undefined ? undefined : formatDate(end),
        ].filter((value): value is string => value !== undefined).join(" – "),
        ...(url === undefined ? {} : { url, urlDisplay: displayUrl(url) }),
        bullets: bullets.map(({ text }) => text),
      })),
    })),
    skills: groupSkills(skills),
  };
}
