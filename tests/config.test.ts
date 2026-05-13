import { describe, expect, it } from "vitest";
import {
	DEFAULT_CONFIG,
	resolveStatsConfig,
	type StatsConfig,
} from "../src/config.js";

describe("config", () => {
	it("returns defaults when no partial provided", () => {
		const config = resolveStatsConfig();
		expect(config.enabled).toBe(true);
		expect(config.cache.ttlSeconds).toBe(600);
		expect(config.steps.topTags.limit).toBe(5);
		expect(config.steps.topEntities.limit).toBe(5);
		expect(config.steps.hotspots.limit).toBe(5);
		expect(config.steps.topMentalModels.limit).toBe(5);
		expect(config.render.totalMaxTokens).toBe(420);
	});

	it("overrides baseUrl from partial", () => {
		const config = resolveStatsConfig({ baseUrl: "http://my-host:9999" });
		expect(config.baseUrl).toBe("http://my-host:9999");
		expect(config.cache.ttlSeconds).toBe(600); // unchanged
	});

	it("overrides step limits independently", () => {
		const config = resolveStatsConfig({
			steps: {
				topTags: { enabled: true, limit: 3, maxTokens: 80 },
			},
		} as Partial<StatsConfig>);
		expect(config.steps.topTags.limit).toBe(3);
		expect(config.steps.topTags.maxTokens).toBe(80);
		expect(config.steps.topEntities.limit).toBe(5); // unchanged
	});

	it("overrides cache config", () => {
		const config = resolveStatsConfig({
			cache: { ttlSeconds: 300 },
		} as Partial<StatsConfig>);
		expect(config.cache.ttlSeconds).toBe(300);
	});

	it("default level for topTags is 2", () => {
		const config = resolveStatsConfig();
		expect(config.steps.topTags.level).toBe(2);
	});

	it("default level for hotspots is 2", () => {
		const config = resolveStatsConfig();
		expect(config.steps.hotspots.level).toBe(2);
	});

	it("topTags maxTokens defaults to 120", () => {
		expect(DEFAULT_CONFIG.steps.topTags.maxTokens).toBe(120);
	});

	it("topEntities maxTokens defaults to 120", () => {
		expect(DEFAULT_CONFIG.steps.topEntities.maxTokens).toBe(120);
	});

	it("hotspots maxTokens defaults to 160", () => {
		expect(DEFAULT_CONFIG.steps.hotspots.maxTokens).toBe(160);
	});

	it("topMentalModels maxTokens defaults to 120", () => {
		expect(DEFAULT_CONFIG.steps.topMentalModels.maxTokens).toBe(120);
	});
});
