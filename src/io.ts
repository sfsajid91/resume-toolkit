import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

export const MAX_INPUT_BYTES = 2_097_152;

export type SnapshotLoadResult =
  | { readonly ok: true; readonly value: unknown; readonly inputHash: string }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: "io_error" | "input_too_large" | "invalid_json";
      readonly message: string;
    };
  };

export async function loadSnapshot(path: string): Promise<SnapshotLoadResult> {
  let bytes: Buffer;
  try {
    const fileStat = await stat(path);
    if (!fileStat.isFile()) {
      return { ok: false, error: { code: "io_error", message: "Input path is not a regular file." } };
    }
    if (fileStat.size > MAX_INPUT_BYTES) {
      return { ok: false, error: { code: "input_too_large", message: "Input exceeds the 2 MiB limit." } };
    }
    bytes = await readFile(path);
  } catch {
    return { ok: false, error: { code: "io_error", message: "Input file could not be read." } };
  }

  if (bytes.byteLength > MAX_INPUT_BYTES) {
    return { ok: false, error: { code: "input_too_large", message: "Input exceeds the 2 MiB limit." } };
  }

  const inputHash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  let value: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    value = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: { code: "invalid_json", message: "Input is not valid UTF-8 JSON." } };
  }

  return { ok: true, value, inputHash };
}

async function canonicalPath(path: string): Promise<string> {
  let candidate = resolve(path);
  const missingParts: string[] = [];

  while (true) {
    try {
      const resolvedPath = await realpath(candidate);
      return resolve(resolvedPath, ...missingParts.reverse());
    } catch (error: unknown) {
      if (!isMissingPath(error)) throw error;
      const parent = dirname(candidate);
      if (parent === candidate) throw error;
      missingParts.push(basename(candidate));
      candidate = parent;
    }
  }
}

function isMissingPath(error: unknown): boolean {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && error.code === "ENOENT";
}

export async function pathsAlias(firstPath: string, secondPath: string): Promise<boolean> {
  const [first, second] = await Promise.all([canonicalPath(firstPath), canonicalPath(secondPath)]);
  if (first === second) return true;

  try {
    const firstStat = await stat(firstPath);
    const secondStat = await stat(secondPath);
    return firstStat.dev === secondStat.dev && firstStat.ino === secondStat.ino;
  } catch (error: unknown) {
    if (isMissingPath(error)) return false;
    throw error;
  }
}
