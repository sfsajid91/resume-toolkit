import type { Application } from "./schema.ts";

export type ResumeSectionKind = Application["resume"]["sections"][number]["kind"];

type ResolvedEntry = {
  readonly heading: string;
  readonly dateText: string;
  readonly detail: string;
  readonly url?: string;
  readonly urlLabel?: string;
  readonly bullets: readonly string[];
};

type ResolvedSkillGroup = {
  readonly category?: string;
  readonly labels: readonly string[];
};

type ResolvedSection =
  | { readonly kind: ResumeSectionKind; readonly title: string; readonly entries: readonly ResolvedEntry[] }
  | { readonly kind: "skills"; readonly title: "TECHNICAL SKILLS" };

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
  readonly sections: readonly ResolvedSection[];
  readonly skills: readonly ResolvedSkillGroup[];
};

const GENERIC_LINK_LABELS = new Set(["github", "linkedin", "portfolio", "website"]);
const URL_STYLE_LABEL = /^(?:https?:\/\/)?(?:www\.)?[^/?#\s]+(?:\/[^?#\s]*|[?#]\S*)$/iu;


const SECTION_TITLES: Record<ResumeSectionKind, string> = {
  experience: "PROFESSIONAL EXPERIENCE",
  projects: "SELECTED PROJECTS",
  education: "EDUCATION",
  certifications: "CERTIFICATIONS",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})$/u.exec(value);
  if (match === null) return value;
  const month = Number(match[2]);
  const name = MONTH_NAMES[month - 1];
  return name === undefined ? value : `${name} ${match[1]}`;
}

export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//iu, "").replace(/^www\./iu, "");
}

function displayLinkLabel(label: string, url: string): string {
  if (GENERIC_LINK_LABELS.has(label.trim().toLowerCase())) return displayUrl(url);
  if (URL_STYLE_LABEL.test(label)) return label;

  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./iu, "").toLowerCase();
  } catch {
    return label;
  }
  const labelDomain = label.trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)/iu, "")
    .replace(/[/?#].*$/u, "")
    .toLowerCase();
  return hostname === labelDomain ? displayUrl(url) : label;
}

function groupSkills(skills: Application["resume"]["skills"]): ResolvedSkillGroup[] {
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
  const { basics, summary, sections, skills, skillsPosition } = application.resume;
  const resolvedSections: ResolvedSection[] = sections.map(({ kind, items }) => ({
    kind,
    title: SECTION_TITLES[kind],
    entries: items.map(({ name, title, issuer, location, start, end, expires, url, bullets }) => {
      const certification = kind === "certifications";
      const expiration = expires ?? (certification && typeof end === "string" ? end : undefined);
      const dateText = certification
        ? [
          start === undefined ? undefined : `Issued ${formatDate(start)}`,
          expiration === undefined ? undefined : `Expires ${formatDate(expiration)}`,
        ].filter((value): value is string => value !== undefined).join(" · ")
        : [
          start === undefined ? undefined : formatDate(start),
          end === null ? "Present" : end === undefined ? undefined : formatDate(end),
        ].filter((value): value is string => value !== undefined).join(" – ");
      const detailValues = kind === "experience" || kind === "education"
        ? url === undefined ? [name, location] : []
        : kind === "projects" ? [title, location] : [issuer, location];
      const detail = detailValues.filter((value): value is string => value !== undefined).join(", ");
      return {
        heading: kind === "experience" || kind === "education" ? title ?? name : name,
        dateText,
        detail,
        ...(url === undefined ? {} : {
          url,
          urlLabel: kind === "projects"
            ? displayUrl(url)
            : kind === "experience" || kind === "education"
              ? [name, location].filter((value): value is string => value !== undefined).join(", ")
              : name,
        }),
        bullets: bullets.map(({ text }) => text),
      };
    }),
  }));
  const skillGroups = groupSkills(skills);
  if (skillGroups.length > 0) {
    const experienceIndex = resolvedSections.findIndex(({ kind }) => kind === "experience");
    const position = skillsPosition ?? "after-experience";
    const index = position === "end"
      ? resolvedSections.length
      : position === "after-summary" ? 0 : experienceIndex < 0 ? 0 : experienceIndex + 1;
    resolvedSections.splice(index, 0, { kind: "skills", title: "TECHNICAL SKILLS" });
  }

  return {
    basics: {
      name: basics.name.toUpperCase(),
      ...(basics.headline === undefined ? {} : { headline: basics.headline }),
      ...(basics.email === undefined ? {} : { email: basics.email }),
      ...(basics.phone === undefined ? {} : { phone: basics.phone }),
      ...(basics.location === undefined ? {} : { location: basics.location }),
      links: basics.links.map(({ label, url }) => ({ label: displayLinkLabel(label, url), url })),
    },
    summary: summary.map(({ text }) => text),
    sections: resolvedSections,
    skills: skillGroups,
  };
}
