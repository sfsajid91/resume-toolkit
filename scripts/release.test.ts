import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { installLatestRelease } from "./release.ts";

async function fixtureArchive(directory: string, version: string, setupScript = "#!/bin/sh\nexit 0\n"): Promise<Uint8Array> {
  const source = join(directory, "source");
  await mkdir(join(source, "scripts"), { recursive: true });
  await writeFile(join(source, "package.json"), JSON.stringify({ name: "resume-toolkit", version }));
  await writeFile(join(source, "bun.lock"), "fixture lock\n");
  await writeFile(join(source, "scripts", "setup.sh"), setupScript);
  const archive = join(directory, "release.tar.gz");
  const result = Bun.spawnSync(["tar", "-czf", archive, "-C", source, "."]);
  if (result.exitCode !== 0) throw new Error("Could not create release fixture archive.");
  return new Uint8Array(await readFile(archive));
}

function serveRelease(archive: Uint8Array, checksum: string, mode: { value: "archive" | "checksum" | "failed" }): { readonly port: number; stop(force?: boolean): void } {
  const server = Bun.serve({
    port: 0,
    fetch(request: Request): Response {
      const path = new URL(request.url).pathname;
      if (mode.value === "failed") return new Response("failure", { status: 503 });
      if (path.endsWith(".sha256")) return new Response(mode.value === "checksum" ? "bad checksum\n" : `${checksum}  resume-toolkit.tar.gz\n`);
      return new Response(archive);
    },
  });
  if (server.port === undefined) throw new Error("Loopback server did not bind a port.");
  return { port: server.port, stop: (force) => server.stop(force) };
}

describe("GitHub release installation", () => {
  test("installs a tagged package and preserves prior unmanaged contents in a stable backup", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resume-release-test-"));
    const archive = await fixtureArchive(directory, "1.2.3");
    const digest = createHash("sha256").update(archive).digest("hex");
    const mode = { value: "archive" as const };
    const server = serveRelease(archive, digest, mode);
    const root = join(directory, "install", "resume-toolkit");
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "previous.txt"), "old release");
    let setupRoot = "";
    try {
      const result = await installLatestRelease({
        root,
        releaseUrl: `http://localhost:${server.port}`,
        installDependencies: async () => { },
        setup: async (updatedRoot) => { setupRoot = updatedRoot; },
      });
      expect(result.version).toBe("1.2.3");
      expect(setupRoot).toBe(root);
      expect(JSON.parse(await readFile(join(root, "package.json"), "utf8"))).toEqual({ name: "resume-toolkit", version: "1.2.3" });
      expect(await readFile(join(`${root}.backup-unmanaged`, "previous.txt"), "utf8")).toBe("old release");
    } finally {
      server.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("migrates an unmarked legacy install even when its package version matches the release", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resume-release-legacy-"));
    const archive = await fixtureArchive(directory, "0.1.1");
    const digest = createHash("sha256").update(archive).digest("hex");
    const server = serveRelease(archive, digest, { value: "archive" });
    const root = join(directory, "install", "resume-toolkit");
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "resume-toolkit", version: "0.1.1" }));
    await writeFile(join(root, "previous.txt"), "legacy checkout data");
    try {
      const result = await installLatestRelease({
        root,
        releaseUrl: `http://localhost:${server.port}`,
        installDependencies: async () => { },
        setup: async () => { },
      });
      expect(result.version).toBe("0.1.1");
      expect(await readFile(join(root, ".resume-toolkit-release"), "utf8")).toBe("0.1.1\n");
      expect(await readFile(join(`${root}.backup-unmanaged`, "previous.txt"), "utf8")).toBe("legacy checkout data");
      await expect(readFile(join(root, "previous.txt"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      server.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("rejects failed downloads, bad checksums, and mismatched archives without replacing the old install", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resume-release-failure-"));
    const archive = await fixtureArchive(directory, "2.0.0");
    const digest = createHash("sha256").update(archive).digest("hex");
    const wrongDirectory = join(directory, "wrong");
    await mkdir(wrongDirectory, { recursive: true });
    const wrongArchive = await fixtureArchive(wrongDirectory, "invalid");
    const root = join(directory, "install", "resume-toolkit");
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "previous.txt"), "keep me");
    const mode: { value: "archive" | "checksum" | "failed" } = { value: "failed" };
    let server = serveRelease(archive, digest, mode);
    try {
      for (const failure of ["failed", "checksum", "archive"] as const) {
        if (failure === "archive") {
          server.stop(true);
          const wrongDigest = createHash("sha256").update(wrongArchive).digest("hex");
          server = serveRelease(wrongArchive, wrongDigest, mode);
        }
        await expect(installLatestRelease({
          root,
          releaseUrl: `http://localhost:${server.port}`,
          installDependencies: async () => { },
          setup: async () => { },
        })).rejects.toThrow();
        expect(await readFile(join(root, "previous.txt"), "utf8")).toBe("keep me");
      }
    } finally {
      server.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("restores the old installation when setup fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resume-release-rollback-"));
    const archive = await fixtureArchive(directory, "3.0.0");
    const digest = createHash("sha256").update(archive).digest("hex");
    const server = serveRelease(archive, digest, { value: "archive" });
    const root = join(directory, "install", "resume-toolkit");
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "previous.txt"), "keep me");
    try {
      await expect(installLatestRelease({
        root,
        releaseUrl: `http://localhost:${server.port}`,
        installDependencies: async () => { },
        setup: async () => { throw new Error("setup failure"); },
      })).rejects.toThrow("setup failure");
      expect(await readFile(join(root, "previous.txt"), "utf8")).toBe("keep me");
    } finally {
      server.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("runs the CLI update command against a loopback release without touching the user's home", async () => {
    const directory = await mkdtemp(join(tmpdir(), "resume-release-cli-"));
    const archive = await fixtureArchive(directory, "4.0.0", "#!/bin/sh\nprintf '%s' \"${1-}\" > \"$(dirname \"$0\")/../workspace-arg\"\n");
    const digest = createHash("sha256").update(archive).digest("hex");
    const server = serveRelease(archive, digest, { value: "archive" });
    const home = join(directory, "home");
    const root = join(home, ".local", "share", "resume-toolkit");
    const fakeBin = join(directory, "bin");
    const workspace = join(directory, "workspace");
    await Promise.all([mkdir(home, { recursive: true }), mkdir(fakeBin, { recursive: true }), mkdir(workspace, { recursive: true })]);
    const fakeBun = join(fakeBin, "bun");
    await writeFile(fakeBun, "#!/bin/sh\nexit 0\n");
    await chmod(fakeBun, 0o755);
    try {
      const environment = {
        ...process.env,
        HOME: home,
        PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
        RESUME_TOOLKIT_DIR: root,
        RESUME_TOOLKIT_RELEASE_URL: `http://localhost:${server.port}`,
      };
      const cliPath = join(import.meta.dir, "../src/cli.ts");
      const invokeUpdate = async (cwd: string): Promise<void> => {
        const child = Bun.spawn([process.execPath, "run", cliPath, "update", "--json"], {
          cwd,
          env: environment,
          stdout: "pipe",
          stderr: "pipe",
        });
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        expect(exitCode).toBe(0);
        expect(stderr).toBe("");
        expect(JSON.parse(stdout)).toEqual({ status: "updated", version: "4.0.0", installation: root });
      };
      await invokeUpdate(workspace);
      expect(await readFile(join(root, "workspace-arg"), "utf8")).toBe(workspace);
      await invokeUpdate(join(import.meta.dir, ".."));
      expect(await readFile(join(root, "workspace-arg"), "utf8")).toBe("");
      expect(JSON.parse(await readFile(join(root, "package.json"), "utf8"))).toEqual({ name: "resume-toolkit", version: "4.0.0" });
    } finally {
      server.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  });
});
