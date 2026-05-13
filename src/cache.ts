import { createHash } from "node:crypto";
import {
	mkdir,
	readFile,
	rename,
	stat,
	unlink,
	writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { CacheConfig } from "./config.js";

export interface CacheEntry<T = unknown> {
	key: string;
	step: string;
	bankId: string;
	fetchedAt: string;
	expiresAt: string;
	data: T;
}

const resolveDir = (dir: string): string => dir.replace(/^~/, homedir());

const buildKey = (baseUrl: string, bankId: string, step: string): string => {
	const raw = `${baseUrl}::${bankId}::${step}`;
	return createHash("sha256").update(raw).digest("hex").slice(0, 24);
};

const isExpired = (entry: CacheEntry): boolean =>
	new Date(entry.expiresAt).getTime() < Date.now();

const isMissingFileError = (err: unknown): boolean => {
	return (
		typeof err === "object" &&
		err !== null &&
		("code" in err ? (err as { code?: unknown }).code === "ENOENT" : false)
	);
};

export const cacheRead = async <T = unknown>(
	config: CacheConfig,
	baseUrl: string,
	bankId: string,
	step: string,
): Promise<CacheEntry<T> | null> => {
	const dir = resolveDir(config.dir);
	const key = buildKey(baseUrl, bankId, step);
	const filePath = join(dir, `${key}.json`);
	try {
		const raw = await readFile(filePath, "utf-8");
		const entry = JSON.parse(raw) as CacheEntry<T>;
		if (isExpired(entry)) {
			if (config.serveStaleOnError) return entry;
			return null;
		}
		return entry;
	} catch (err) {
		if (!isMissingFileError(err)) {
			console.error("[hindsight-stats] cacheRead failed:", err instanceof Error ? err.message : String(err));
		}
		return null;
	}
};

export const cacheWrite = async <T = unknown>(
	config: CacheConfig,
	baseUrl: string,
	bankId: string,
	step: string,
	data: T,
	ttlSeconds: number,
): Promise<CacheEntry<T>> => {
	const dir = resolveDir(config.dir);
	const key = buildKey(baseUrl, bankId, step);
	const filePath = join(dir, `${key}.json`);
	const tmpPath = join(dir, `${key}.tmp`);
	const now = new Date();
	const entry: CacheEntry<T> = {
		key,
		step,
		bankId,
		fetchedAt: now.toISOString(),
		expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
		data,
	};
	await mkdir(dir, { recursive: true });
	await writeFile(tmpPath, JSON.stringify(entry, null, 2));
	await rename(tmpPath, filePath);
	return entry;
};

export const cacheClear = async (config: CacheConfig): Promise<number> => {
	const dir = resolveDir(config.dir);
	let count = 0;
	try {
		const { readdir } = await import("node:fs/promises");
		const files = await readdir(dir);
		for (const file of files) {
			if (file.endsWith(".json")) {
				await unlink(join(dir, file));
				count++;
			}
		}
	} catch (err) {
		// dir may not exist
		if (!isMissingFileError(err)) {
			console.error("[hindsight-stats] cacheClear readdir/unlink failed:", err instanceof Error ? err.message : String(err));
		}
	}
	return count;
};
