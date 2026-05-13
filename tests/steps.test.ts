import { describe, expect, it } from "vitest";
import type {
	EntityGraph,
	EntityItem,
	MentalModelItem,
	TagItem,
} from "../src/client.js";
import type { StepConfig } from "../src/config.js";
import {
	extractHotspots,
	groupTags,
	groupToLevel,
	type HotspotChain,
	rankEntities,
	rankMentalModels,
	rankTags,
	renderCover,
	renderEntities,
	renderHotspots,
	renderMentalModels,
	renderTags,
} from "../src/steps.js";

describe("steps", () => {
	describe("groupToLevel", () => {
		it("collapses to level 2 by default", () => {
			expect(groupToLevel("repo:vendor-omo:auth", 2)).toBe("repo:vendor-omo");
		});
		it("keeps tag if shorter than level", () => {
			expect(groupToLevel("repo:vendor-omo", 2)).toBe("repo:vendor-omo");
		});
		it("level 1 keeps namespace only", () => {
			expect(groupToLevel("repo:vendor-omo", 1)).toBe("repo");
		});
		it("no colon stays unchanged", () => {
			expect(groupToLevel("plain", 2)).toBe("plain");
		});
	});

	describe("groupTags", () => {
		it("groups and sums counts", () => {
			const tags: TagItem[] = [
				{ tag: "repo:vendor-omo:auth", count: 10 },
				{ tag: "repo:vendor-omo:session", count: 20 },
				{ tag: "topic:auth", count: 5 },
			];
			const grouped = groupTags(tags, 2);
			expect(grouped).toEqual([
				{ tag: "repo:vendor-omo", count: 30 },
				{ tag: "topic:auth", count: 5 },
			]);
		});
		it("no grouping when level undefined", () => {
			const tags: TagItem[] = [{ tag: "repo:vendor-omo", count: 10 }];
			expect(groupTags(tags)).toEqual(tags);
		});
	});

	describe("rankTags", () => {
		const config: StepConfig = {
			enabled: true,
			limit: 5,
			maxTokens: 120,
			level: 2,
		};
		it("limits to config.limit", () => {
			const tags: TagItem[] = Array.from({ length: 10 }, (_, i) => ({
				tag: `t:${i}`,
				count: 10 - i,
			}));
			const ranked = rankTags(tags, config);
			expect(ranked).toHaveLength(5);
		});
		it("applies level grouping", () => {
			const tags: TagItem[] = [
				{ tag: "repo:a:x", count: 5 },
				{ tag: "repo:a:y", count: 3 },
			];
			const ranked = rankTags(tags, config);
			expect(ranked).toEqual([{ tag: "repo:a", count: 8 }]);
		});
	});

	describe("rankEntities", () => {
		const config: StepConfig = { enabled: true, limit: 5, maxTokens: 120 };
		it("sorts by mention_count desc", () => {
			const entities: EntityItem[] = [
				{ id: "1", canonical_name: "Alice", mention_count: 10 },
				{ id: "2", canonical_name: "Bob", mention_count: 50 },
			];
			const ranked = rankEntities(entities, config);
			expect(ranked[0].canonical_name).toBe("Bob");
		});
		it("limits to config.limit", () => {
			const entities: EntityItem[] = Array.from({ length: 10 }, (_, i) => ({
				id: String(i),
				canonical_name: `E${i}`,
				mention_count: 10 - i,
			}));
			expect(rankEntities(entities, config)).toHaveLength(5);
		});
	});

	describe("rankMentalModels", () => {
		const config: StepConfig = { enabled: true, limit: 5, maxTokens: 120 };
		it("sorts by last_refreshed_at desc", () => {
			const models: MentalModelItem[] = [
				{ id: "1", name: "old", last_refreshed_at: "2026-01-01T00:00:00Z" },
				{ id: "2", name: "new", last_refreshed_at: "2026-04-30T00:00:00Z" },
			];
			const ranked = rankMentalModels(models, config);
			expect(ranked[0].name).toBe("new");
		});
		it("limits to config.limit", () => {
			const models: MentalModelItem[] = Array.from({ length: 10 }, (_, i) => ({
				id: String(i),
				name: `M${i}`,
			}));
			expect(rankMentalModels(models, config)).toHaveLength(5);
		});
	});

	describe("extractHotspots", () => {
		it("extracts chains from entity graph", () => {
			const graph: EntityGraph = {
				nodes: [
					{ id: "a", canonical_name: "Auth" },
					{ id: "b", canonical_name: "Stripe" },
					{ id: "c", canonical_name: "Session" },
				],
				edges: [
					{ source: "a", target: "b", weight: 10 },
					{ source: "a", target: "c", weight: 5 },
				],
			};
			const config: StepConfig & { chainSize?: number } = {
				enabled: true,
				limit: 5,
				maxTokens: 160,
				chainSize: 3,
			};
			const chains = extractHotspots(graph, config);
			expect(chains.length).toBeGreaterThanOrEqual(1);
			expect(chains[0].nodes).toContain("Auth");
			expect(chains[0].nodes).toContain("Stripe");
		});
		it("returns empty for empty graph", () => {
			const graph: EntityGraph = { nodes: [], edges: [] };
			const config: StepConfig & { chainSize?: number } = {
				enabled: true,
				limit: 5,
				maxTokens: 160,
			};
			expect(extractHotspots(graph, config)).toEqual([]);
		});
	});

	describe("renderTags", () => {
		it("renders compact tag block", () => {
			const tags: TagItem[] = [
				{ tag: "repo:vendor-omo", count: 182 },
				{ tag: "topic:auth", count: 91 },
			];
			const rendered = renderTags(tags, 120);
			expect(rendered).toContain("[Top Tags]");
			expect(rendered).toContain("repo:vendor-omo (182)");
			expect(rendered).toContain("topic:auth (91)");
		});
		it("returns empty string for no tags", () => {
			expect(renderTags([], 120)).toBe("");
		});
	});

	describe("renderEntities", () => {
		it("renders compact entity block", () => {
			const entities: EntityItem[] = [
				{ id: "1", canonical_name: "Alice", mention_count: 54 },
			];
			const rendered = renderEntities(entities, 120);
			expect(rendered).toContain("[Top Entities]");
			expect(rendered).toContain("Alice (54)");
		});
	});

	describe("renderHotspots", () => {
		it("renders hotspot chains", () => {
			const chains: HotspotChain[] = [
				{ nodes: ["Auth", "Stripe", "Session"], weight: 15 },
			];
			const rendered = renderHotspots(chains, 160);
			expect(rendered).toContain("Auth ↔ Stripe ↔ Session");
		});
	});

	describe("renderMentalModels", () => {
		it("renders model names", () => {
			const models: MentalModelItem[] = [{ id: "1", name: "user-preferences" }];
			const rendered = renderMentalModels(models, 120);
			expect(rendered).toContain("user-preferences");
		});
	});

	describe("renderCover", () => {
		it("renders full cover with all blocks", () => {
			const result = renderCover(
				{
					topTags: [{ tag: "repo:vendor-omo", count: 182 }],
					topEntities: [
						{ id: "1", canonical_name: "Alice", mention_count: 54 },
					],
					hotspots: [{ nodes: ["Auth", "Stripe"], weight: 10 }],
					topMentalModels: [{ id: "1", name: "user-preferences" }],
				},
				{ ...DEFAULT_CONFIG },
			);
			expect(result).toContain("[Top Tags]");
			expect(result).toContain("[Top Entities]");
			expect(result).toContain("[Hotspots]");
			expect(result).toContain("[Top Mental Models]");
		});

		it("skips disabled steps", () => {
			const config = {
				...DEFAULT_CONFIG,
				steps: {
					...DEFAULT_CONFIG.steps,
					topTags: { ...DEFAULT_CONFIG.steps.topTags, enabled: false },
				},
			};
			const result = renderCover(
				{
					topTags: [{ tag: "x", count: 1 }],
					topEntities: [],
					hotspots: [],
					topMentalModels: [],
				},
				config,
			);
			expect(result).not.toContain("[Top Tags]");
		});
	});
});

const DEFAULT_CONFIG = {
	enabled: true,
	baseUrl: "http://localhost:8888",
	bankId: "test",
	injectOnSessionStart: true,
	showStatusMessage: true,
	cache: { dir: "/tmp/hs-test", ttlSeconds: 600, serveStaleOnError: true },
	steps: {
		topTags: { enabled: true, limit: 5, maxTokens: 120, level: 2 },
		topEntities: { enabled: true, limit: 5, maxTokens: 120 },
		hotspots: {
			enabled: true,
			limit: 5,
			maxTokens: 160,
			level: 2,
			chainSize: 3,
		},
		topMentalModels: { enabled: true, limit: 5, maxTokens: 120 },
	},
	render: { totalMaxTokens: 420, compact: true },
};
