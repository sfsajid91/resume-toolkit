import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

const skillUrl = new URL("../skills/resume-toolkit/SKILL.md", import.meta.url);

describe("resume-toolkit skill", () => {
  test("keeps front matter, line limit, and relative links valid", async () => {
    const contents = await readFile(skillUrl, "utf8");
    expect(contents.split(/\r?\n/u).length).toBeLessThan(120);
    const frontMatter = contents.match(/^---\r?\n([\s\S]*?)\r?\n---/u)?.[1];
    expect(frontMatter).toBeDefined();
    expect(frontMatter).toMatch(/^name:\s*resume-toolkit\s*$/mu);
    const description = frontMatter?.match(/^description:\s*>-?\s*\n((?:[ \t]+.*(?:\n|$))+)/mu)?.[1];
    expect(description?.trim().length).toBeGreaterThan(0);

    const links = [...contents.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)].map(([, target]) => target ?? "");
    for (const target of links) {
      const destination = fileURLToPath(new URL(target, skillUrl));
      await access(destination);
    }
  });
});
