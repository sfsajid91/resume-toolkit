import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { writeStagedOutput } from "./io.ts";

async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "resume-toolkit-io-"));
}

describe("staged output writes", () => {
  test("publishes atomically without clobbering and replaces only with force", async () => {
    const directory = await temporaryDirectory();
    const output = join(directory, "resume.pdf");
    try {
      await writeStagedOutput(output, false, (path) => writeFile(path, "first"));
      expect(await readFile(output, "utf8")).toBe("first");

      await expect(writeStagedOutput(output, false, (path) => writeFile(path, "rejected")))
        .rejects.toMatchObject({ code: "EEXIST" });
      expect(await readFile(output, "utf8")).toBe("first");

      await writeStagedOutput(output, true, (path) => writeFile(path, "second"));
      expect(await readFile(output, "utf8")).toBe("second");
      expect((await readdir(directory)).filter((name) => name.startsWith(".resume-toolkit-"))).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("preserves an existing output and removes owned staging after generator failure", async () => {
    const directory = await temporaryDirectory();
    const output = join(directory, "resume.docx");
    try {
      await writeFile(output, "existing");
      await expect(writeStagedOutput(output, true, async (path) => {
        await writeFile(path, "partial");
        throw new Error("generation failed");
      })).rejects.toThrow("generation failed");
      expect(await readFile(output, "utf8")).toBe("existing");
      expect((await readdir(directory)).filter((name) => name.startsWith(".resume-toolkit-"))).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
