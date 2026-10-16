import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const REPOSITORY = "resume-toolkit";
const RELEASE_MARKER = ".resume-toolkit-release";
const RELEASE_URL = "https://github.com/sfsajid91/resume-toolkit/releases/latest/download";
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u;

export type ReleaseInstallOptions = {
  readonly root: string;
  readonly workspace?: string;
  readonly fetcher?: typeof fetch;
  readonly releaseUrl?: string;
  readonly installDependencies?: (root: string) => Promise<void>;
  readonly setup?: (root: string, workspace?: string) => Promise<void>;
};

export async function installLatestRelease(options: ReleaseInstallOptions): Promise<{ version: string }> {
  const root = resolve(options.root);
  const fetcher = options.fetcher ?? fetch;
  const releaseUrl = options.releaseUrl ?? RELEASE_URL;
  const archiveResponse = await fetcher(`${releaseUrl}/resume-toolkit.tar.gz`);
  if (!archiveResponse.ok) throw new Error(`Latest release download failed (${archiveResponse.status}).`);
  const bytes = new Uint8Array(await archiveResponse.arrayBuffer());
  const checksumResponse = await fetcher(`${releaseUrl}/resume-toolkit.tar.gz.sha256`);
  if (!checksumResponse.ok) throw new Error(`Latest release checksum download failed (${checksumResponse.status}).`);
  const checksum = /^([a-f0-9]{64})\s+\*?resume-toolkit\.tar\.gz\s*$/u.exec(await checksumResponse.text())?.[1];
  if (!checksum || createHash("sha256").update(bytes).digest("hex") !== checksum) {
    throw new Error("Latest release archive checksum did not match.");
  }

  const parent = join(root, "..");
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(join(parent, ".resume-toolkit-update-"));
  const staged = join(temporary, "toolkit");
  let backup: string | undefined;
  let previousVersion: string | undefined;
  let hadPrevious = false;
  let replaced = false;
  try {
    await mkdir(staged);
    const archivePath = join(temporary, "release.tar.gz");
    await writeFile(archivePath, bytes, { flag: "wx", mode: 0o600 });
    await extractArchive(archivePath, staged);
    const packageJson: unknown = JSON.parse(await readFile(join(staged, "package.json"), "utf8")) as unknown;
    if (!isPackage(packageJson) || !(await isFile(join(staged, "scripts/setup.sh"))) || !(await isFile(join(staged, "bun.lock")))) {
      throw new Error("Release archive contents are invalid or incomplete.");
    }
    const version = packageJson.version;
    if (await isDirectory(root)) {
      let previousPackage: unknown;
      let marker: string | undefined;
      try { previousPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as unknown; } catch { }
      try { marker = await readFile(join(root, RELEASE_MARKER), "utf8"); } catch { }
      if (isPackage(previousPackage) && marker === `${previousPackage.version}\n`) {
        previousVersion = previousPackage.version;
        if (previousVersion === version) {
          await (options.setup ?? defaultSetup)(root, options.workspace);
          return { version };
        }
      }
    }
    await (options.installDependencies ?? ((directory) => run("bun", ["install", "--frozen-lockfile"], directory)))(staged);
    if (await isDirectory(root)) {
      backup = `${root}.backup-${previousVersion ?? "unmanaged"}`;
      if (await lstat(backup).then(() => true, () => false)) {
        throw new Error(`Previous installation backup already exists at ${backup}; refusing to replace it.`);
      }
      await rename(root, backup);
      hadPrevious = true;
    }
    await rename(staged, root);
    replaced = true;
    await (options.setup ?? defaultSetup)(root, options.workspace);
    await writeFile(join(root, RELEASE_MARKER), `${version}\n`, { flag: "wx", mode: 0o600 });
    return { version };
  } catch (error) {
    if (replaced) await rm(root, { recursive: true, force: true });
    if (hadPrevious && backup !== undefined) {
      await rename(backup, root);
      try { await (options.setup ?? defaultSetup)(root, options.workspace); } catch { /* Preserve the prior release if setup cannot be restored. */ }
    }
    throw error;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function isPackage(value: unknown): value is { readonly name: string; readonly version: string } {
  return value !== null && typeof value === "object" && "name" in value && value.name === REPOSITORY
    && "version" in value && typeof value.version === "string" && VERSION_PATTERN.test(value.version);
}

async function extractArchive(archive: string, destination: string): Promise<void> {
  const listing = await output("tar", ["-tzf", archive]);
  const entries = listing.split("\n").filter(Boolean);
  if (entries.length === 0 || entries.some((entry) => entry.startsWith("/") || entry.split("/").includes(".."))) {
    throw new Error("Release archive contains unsafe paths.");
  }
  await run("tar", ["-xzf", archive, "--no-same-owner", "--no-same-permissions", "-C", destination], destination);
}

async function defaultSetup(root: string, workspace?: string): Promise<void> {
  await run("bash", [join(root, "scripts/setup.sh"), ...(workspace ? [workspace] : [])], root);
}

async function isFile(path: string): Promise<boolean> {
  try { return (await Bun.file(path).stat()).isFile(); } catch { return false; }
}

async function isDirectory(path: string): Promise<boolean> {
  try { return (await Bun.file(path).stat()).isDirectory(); } catch { return false; }
}

function run(command: string, args: readonly string[], cwd: string): Promise<void> {
  const { promise, resolve: finish, reject } = Promise.withResolvers<void>();
  const child = spawn(command, [...args], { cwd, stdio: "inherit" });
  child.once("error", reject);
  child.once("close", (code) => code === 0 ? finish() : reject(new Error(`${command} failed (${code ?? "signal"}).`)));
  return promise;
}

function output(command: string, args: readonly string[]): Promise<string> {
  const { promise, resolve: finish, reject } = Promise.withResolvers<string>();
  const child = spawn(command, [...args], { stdio: ["ignore", "pipe", "inherit"] });
  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
  child.once("error", reject);
  child.once("close", (code) => code === 0 ? finish(Buffer.concat(chunks).toString("utf8")) : reject(new Error(`${command} failed (${code ?? "signal"}).`)));
  return promise;
}

if (import.meta.main) {
  const home = process.env.HOME;
  if (!home) throw new Error("HOME must be set.");
  const workspace = process.argv[2] ? resolve(process.argv[2]) : undefined;
  const root = process.env.RESUME_TOOLKIT_DIR ?? join(home, ".local", "share", REPOSITORY);
  try {
    const { version } = await installLatestRelease({ root, ...(workspace ? { workspace } : {}) });
    process.stdout.write(`Installed resume-toolkit ${version} at ${root}\n`);
  } catch (error) {
    process.stderr.write(`resume-toolkit update failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  }
}
