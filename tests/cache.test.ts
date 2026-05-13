import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readFileMock = vi.hoisted(() => vi.fn());
const mkdirMock = vi.hoisted(() => vi.fn());
const renameMock = vi.hoisted(() => vi.fn());
const unlinkMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());
const readdirMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
	readFile: readFileMock,
	mkdir: mkdirMock,
	rename: renameMock,
	unlink: unlinkMock,
	writeFile: writeFileMock,
	readdir: readdirMock,
}));

describe("hindsight-stats cache", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("cacheRead ignores missing cache files without logging", async () => {
		readFileMock.mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const { cacheRead } = await import("../src/cache.ts");

		const result = await cacheRead(
			{ dir: "~/.hindsight/cache/stats", ttlSeconds: 10, serveStaleOnError: true },
			"http://example",
			"bank",
			"topTags",
		);

		expect(result).toBeNull();
		expect(errSpy).not.toHaveBeenCalled();
	});

	it("cacheRead logs non-ENOENT failures", async () => {
		readFileMock.mockRejectedValue(new Error("boom"));
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const { cacheRead } = await import("../src/cache.ts");

		await cacheRead(
			{ dir: "~/.hindsight/cache/stats", ttlSeconds: 10, serveStaleOnError: true },
			"http://example",
			"bank",
			"topTags",
		);

		expect(errSpy).toHaveBeenCalled();
	});

	it("stats defaults do not inject on session start", async () => {
		const { DEFAULT_CONFIG } = await import("../src/config.ts");
		expect(DEFAULT_CONFIG.injectOnSessionStart).toBe(false);
	});
});
