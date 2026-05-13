import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { cacheRead, cacheWrite } from "./cache.js";
import type { EntityItem, MentalModelItem, TagItem } from "./client.js";
import { fetchAllStats } from "./client.js";
import { resolveStatsConfig, type StatsConfig } from "./config.js";
import type { HotspotChain } from "./steps.js";
import {
	extractHotspots,
	rankEntities,
	rankMentalModels,
	rankTags,
	renderCover,
} from "./steps.js";

let currentConfig: StatsConfig | null = null;
let fetchInFlight: Promise<void> | null = null;

const loadConfig = (cwd: string): StatsConfig => {
	// Try loading from ~/.hindsight/stats-config.json
	// Fall back to defaults
	try {
		// In a real impl, read from file; for now use defaults + env
		const envBaseUrl = process.env.HINDSIGHT_BASE_URL;
		const envApiKey = process.env.HINDSIGHT_API_KEY;
		const envBankId = process.env.HINDSIGHT_BANK_ID;
		const partial: Partial<StatsConfig> = {};
		if (envBaseUrl) partial.baseUrl = envBaseUrl;
		if (envApiKey) partial.apiKey = envApiKey;
		if (envBankId) partial.bankId = envBankId;
		return resolveStatsConfig(partial);
	} catch (err) {
		console.error("[hindsight-stats] loadConfig failed:", err instanceof Error ? err.message : String(err));
		return resolveStatsConfig();
	}
};

const buildAndRender = async (config: StatsConfig): Promise<string | null> => {
	const { baseUrl, apiKey, bankId, cache: cacheCfg, steps } = config;
	const stats: {
		topTags: TagItem[];
		topEntities: EntityItem[];
		hotspots: HotspotChain[];
		topMentalModels: MentalModelItem[];
	} = { topTags: [], topEntities: [], hotspots: [], topMentalModels: [] };

	// For each step, try cache then fetch
	if (steps.topTags.enabled) {
		const cached = await cacheRead<TagItem[]>(
			cacheCfg,
			baseUrl,
			bankId,
			"topTags",
		);
		if (cached && !isExpiredEntry(cached, cacheCfg.ttlSeconds)) {
			stats.topTags = cached.data;
		} else {
			try {
				const { topTags } = await fetchAllStats(baseUrl, apiKey, bankId, {
					tags: steps.topTags.limit,
					entities: 0,
					graph: 0,
					mentalModels: 0,
				});
				stats.topTags = topTags;
				await cacheWrite(
					cacheCfg,
					baseUrl,
					bankId,
					"topTags",
					topTags,
					cacheCfg.ttlSeconds,
				);
			} catch (err) { console.error("[hindsight-stats] topTags fetch/cache failed:", err instanceof Error ? err.message : String(err)); }
		}
	}

	if (steps.topEntities.enabled) {
		const cached = await cacheRead<EntityItem[]>(
			cacheCfg,
			baseUrl,
			bankId,
			"topEntities",
		);
		if (cached && !isExpiredEntry(cached, cacheCfg.ttlSeconds)) {
			stats.topEntities = cached.data;
		} else {
			try {
				const { topEntities } = await fetchAllStats(baseUrl, apiKey, bankId, {
					tags: 0,
					entities: steps.topEntities.limit,
					graph: 0,
					mentalModels: 0,
				});
				stats.topEntities = topEntities;
				await cacheWrite(
					cacheCfg,
					baseUrl,
					bankId,
					"topEntities",
					topEntities,
					cacheCfg.ttlSeconds,
				);
			} catch (err) { console.error("[hindsight-stats] topEntities fetch/cache failed:", err instanceof Error ? err.message : String(err)); }
		}
	}

	if (steps.hotspots.enabled) {
		const cached = await cacheRead<{ graph: any }>(
			cacheCfg,
			baseUrl,
			bankId,
			"hotspots",
		);
		if (cached && !isExpiredEntry(cached, cacheCfg.ttlSeconds)) {
			stats.hotspots = extractHotspots(cached.data.graph, steps.hotspots);
		} else {
			try {
				const { entityGraph } = await fetchAllStats(baseUrl, apiKey, bankId, {
					tags: 0,
					entities: 0,
					graph: steps.hotspots.limit * 3,
					mentalModels: 0,
				});
				stats.hotspots = extractHotspots(entityGraph, steps.hotspots);
				await cacheWrite(
					cacheCfg,
					baseUrl,
					bankId,
					"hotspots",
					{ graph: entityGraph },
					cacheCfg.ttlSeconds,
				);
			} catch (err) { console.error("[hindsight-stats] hotspots fetch/cache failed:", err instanceof Error ? err.message : String(err)); }
		}
	}

	if (steps.topMentalModels.enabled) {
		const cached = await cacheRead<MentalModelItem[]>(
			cacheCfg,
			baseUrl,
			bankId,
			"topMentalModels",
		);
		if (cached && !isExpiredEntry(cached, cacheCfg.ttlSeconds)) {
			stats.topMentalModels = cached.data;
		} else {
			try {
				const { topMentalModels } = await fetchAllStats(
					baseUrl,
					apiKey,
					bankId,
					{
						tags: 0,
						entities: 0,
						graph: 0,
						mentalModels: steps.topMentalModels.limit,
					},
				);
				stats.topMentalModels = topMentalModels;
				await cacheWrite(
					cacheCfg,
					baseUrl,
					bankId,
					"topMentalModels",
					topMentalModels,
					cacheCfg.ttlSeconds,
				);
			} catch (err) { console.error("[hindsight-stats] topMentalModels fetch/cache failed:", err instanceof Error ? err.message : String(err)); }
		}
	}

	const rendered = renderCover(stats, config);
	if (!rendered) return null;
	return `<hindsight_stats>\n${rendered}\n</hindsight_stats>`;
};

const isExpiredEntry = (
	entry: { expiresAt: string },
	ttlSeconds: number,
): boolean => {
	return new Date(entry.expiresAt).getTime() < Date.now();
};

export default function hindsightStatsExtension(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event: any, ctx: any) => {
		if (!currentConfig) {
			currentConfig = loadConfig(ctx.cwd);
		}
		if (!currentConfig.enabled || !currentConfig.injectOnSessionStart) return;

		// Non-blocking: fire and forget
		fetchInFlight = (async () => {
			try {
				const rendered = await buildAndRender(currentConfig!);
				if (rendered) {
					pi.sendMessage(
						{
							customType: "hindsight-stats-cover",
							content: rendered,
							display: currentConfig!.showStatusMessage,
						},
						{ triggerTurn: false },
					);
				}
			} catch (err) {
				console.error("[hindsight-stats] buildAndRender failed:", err instanceof Error ? err.message : String(err));
			}
		})();
	});

	pi.registerCommand("hindsight-stats:cover", {
		description: "Show Hindsight stats cover for current bank",
		handler: async (_args: string, ctx: any) => {
			const config = loadConfig(ctx.cwd);
			const rendered = await buildAndRender(config);
			ctx.ui.notify(rendered ?? "No stats available", "info");
		},
	});

	pi.registerCommand("hindsight-stats:cache-clear", {
		description: "Clear the shared Hindsight stats cache",
		handler: async (_args: string, _ctx: any) => {
			const { cacheClear } = await import("./cache.js");
			const config = currentConfig ?? loadConfig(".");
			const count = await cacheClear(config.cache);
			_ctx.ui.notify(`Cleared ${count} cache entries`, "info");
		},
	});
}

export { buildAndRender, loadConfig };
