import type { Application } from "../application/schema.ts";

export type ResumeSectionKind = Application["resume"]["sections"][number]["kind"];

type LinkIcon = "globe" | "github";

type ResolvedEntry = {
  readonly heading: string;
  readonly dateText: string;
  readonly detail: string;
  readonly subtitle: readonly [string, string, string];
  readonly url?: string;
  readonly urlLabel?: string;
  readonly urlIcon?: LinkIcon;
  readonly bullets: readonly string[];
};

type ResolvedSkillGroup = {
  readonly category?: string;
  readonly labels: readonly string[];
};

type ResolvedSection =
  | { readonly kind: "summary"; readonly title: "PROFESSIONAL SUMMARY" }
  | { readonly kind: ResumeSectionKind; readonly title: string; readonly entries: readonly ResolvedEntry[]; readonly subtitleSlots: boolean }
  | { readonly kind: "skills"; readonly title: "TECHNICAL SKILLS" };

export type ResolvedResume = {
  readonly basics: {
    readonly name: string;
    readonly headline?: string;
    readonly email?: string;
    readonly phone?: string;
    readonly location?: string;
    readonly links: readonly { readonly label: string; readonly url?: string; readonly icon?: LinkIcon }[];
    readonly linkLines: readonly (readonly { readonly label: string; readonly url?: string; readonly icon?: LinkIcon }[])[];
  };
  readonly summary: readonly string[];
  readonly sections: readonly ResolvedSection[];
  readonly skills: readonly ResolvedSkillGroup[];
};

const GENERIC_LINK_LABELS: Record<string, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  portfolio: "Portfolio",
  website: "Portfolio",
};

function linkIcon(url: string): LinkIcon {
  try {
    return new URL(url).hostname.replace(/^www\./iu, "").toLowerCase() === "github.com" ? "github" : "globe";
  } catch {
    return "globe";
  }
}

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
  return url.replace(/^https?:\/\//iu, "").replace(/^www\./iu, "").replace(/\/+$/u, "");
}
const displayLinkLabel = (label: string) => {
  const key = label.trim().toLowerCase();
  return Object.hasOwn(GENERIC_LINK_LABELS, key) ? GENERIC_LINK_LABELS[key]! : label;
};


function groupHeaderLinks(links: readonly { readonly label: string; readonly url?: string }[]) {
  if (links.length < 2) return [links];
  const lengths = links.map(({ label }) => label.length);
  const labelLength = lengths.reduce((sum, length) => sum + length, 0);
  if (labelLength + 3 * (links.length - 1) <= 92) return [links];

  const minimumGroupSize = links.length >= 4 ? 2 : 1;
  let split = minimumGroupSize;
  let best = Number.POSITIVE_INFINITY;
  let leftLength = lengths.slice(0, minimumGroupSize).reduce((sum, length) => sum + length, 0);
  for (let index = minimumGroupSize; index <= links.length - minimumGroupSize; index += 1) {
    const left = leftLength + 3 * (index - 1);
    const right = labelLength - leftLength + 3 * (links.length - index - 1);
    const score = Math.max(left, right);
    if (score < best) {
      best = score;
      split = index;
    }
    leftLength += lengths[index] ?? 0;
  }
  return [links.slice(0, split), links.slice(split)];
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
  const { basics, summary, sections, skills, sectionOrder } = application.resume;
  const resolvedSections = sections.map((section) => {
    const subtitleSlots = (section.kind === "experience" || section.kind === "projects")
      && section.items.some((item) => item.location !== undefined || (section.kind === "experience" && item.url !== undefined));
    return {
      kind: section.kind,
      title: SECTION_TITLES[section.kind],
      subtitleSlots,
      entries: section.items.map((item) => {
        const { name, title, issuer, location, start, end, expires, url, bullets } = item;
        const certification = section.kind === "certifications";
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
        const urlIcon = url === undefined ? undefined : linkIcon(url);
        const detailValues = subtitleSlots
          ? section.kind === "projects" ? [title] : []
          : section.kind === "experience" || section.kind === "education"
            ? url === undefined ? [name, location] : []
            : section.kind === "projects" ? [title, location] : [issuer, location];
        const detail = detailValues.filter((value): value is string => value !== undefined).join(", ");
        return {
          heading: section.kind === "experience" || section.kind === "education" ? title ?? name : name,
          dateText,
          detail,
          subtitle: [
            section.kind === "experience" && title !== undefined ? name : location ?? "",
            section.kind === "experience" && title !== undefined ? (location ?? "") : "",
            "",
          ] as const,
          ...(url === undefined ? {} : {
            url,
            urlLabel: section.kind === "projects" ? urlIcon === "github" ? "GitHub" : "Live" : name,
            urlIcon: urlIcon ?? "globe",
          }),
          bullets: bullets.map(({ text }) => text),
        };
      }),
    };
  });
  const skillGroups = groupSkills(skills);
  const defaultOrder: ("summary" | "skills" | ResumeSectionKind)[] = ["summary"];
  let skillsPlaced = false;
  if (!resolvedSections.some(({ kind }) => kind === "experience")) {
    defaultOrder.push("skills");
    skillsPlaced = true;
  }
  for (const section of resolvedSections) {
    defaultOrder.push(section.kind);
    if (section.kind === "experience" && !skillsPlaced) {
      defaultOrder.push("skills");
      skillsPlaced = true;
    }
  }
  if (!skillsPlaced) defaultOrder.push("skills");
  const order = sectionOrder === undefined
    ? defaultOrder
    : [...sectionOrder, ...defaultOrder.filter((kind) => !sectionOrder.includes(kind))];
  const sectionByKind = new Map(
    resolvedSections.map((section) => [section.kind, section] as const),
  );
  const orderedSections: ResolvedSection[] = [];
  for (const kind of order) {
    if (kind === "summary") {
      if (summary.length > 0) orderedSections.push({ kind: "summary", title: "PROFESSIONAL SUMMARY" });
    } else if (kind === "skills") {
      if (skillGroups.length > 0) orderedSections.push({ kind: "skills", title: "TECHNICAL SKILLS" });
    } else {
      const section = sectionByKind.get(kind);
      if (section !== undefined && section.entries.length > 0) orderedSections.push(section);
    }
  }

  return {
    basics: {
      name: basics.name.toUpperCase(),
      ...(basics.headline === undefined ? {} : { headline: basics.headline }),
      ...(basics.email === undefined ? {} : { email: basics.email }),
      ...(basics.phone === undefined ? {} : { phone: basics.phone }),
      ...(basics.location === undefined ? {} : { location: basics.location }),
      links: basics.links.map(({ label, url }) => ({
        label: displayLinkLabel(label),
        ...(url === undefined ? {} : { url, icon: linkIcon(url) }),
      })),
      linkLines: groupHeaderLinks(basics.links.map(({ label, url }) => ({
        label: displayLinkLabel(label),
        ...(url === undefined ? {} : { url, icon: linkIcon(url) }),
      }))),
    },
    summary: summary.map(({ text }) => text),
    sections: orderedSections,
    skills: skillGroups,
  };
}
