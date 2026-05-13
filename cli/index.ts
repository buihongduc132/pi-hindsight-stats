#!/usr/bin/env npx tsx
import { cacheClear } from "../src/cache.js";
import type { EntityItem, MentalModelItem, TagItem } from "../src/client.js";
import { fetchAllStats } from "../src/client.js";
import { resolveStatsConfig, type StatsConfig } from "../src/config.js";
import type { HotspotChain } from "../src/steps.js";
import {
	extractHotspots,
	rankEntities,
	rankMentalModels,
	rankTags,
	renderCover,
} from "../src/steps.js";

const command = process.argv[2] ?? "cover";
const envBaseUrl = process.env.HINDSIGHT_BASE_URL;
const envApiKey = process.env.HINDSIGHT_API_KEY;
const envBankId = process.env.HINDSIGHT_BANK_ID;

const partial: Partial<StatsConfig> = {};
if (envBaseUrl) partial.baseUrl = envBaseUrl;
if (envApiKey) partial.apiKey = envApiKey;
if (envBankId) partial.bankId = envBankId;
const config = resolveStatsConfig(partial);

const run = async (): Promise<void> => {
	switch (command) {
		case "cover": {
			const { baseUrl, apiKey, bankId, steps } = config;
			const result = await fetchAllStats(baseUrl, apiKey, bankId, {
				tags: steps.topTags.limit,
				entities: steps.topEntities.limit,
				graph: steps.hotspots.limit * 3,
				mentalModels: steps.topMentalModels.limit,
			});
			const hotspots = extractHotspots(result.entityGraph, steps.hotspots);
			console.log(renderCover({ ...result, hotspots }, config));
			break;
		}
		case "top-tags": {
			const tags = await import("../src/client.js").then((m) =>
				m.fetchTopTags(
					config.baseUrl,
					config.apiKey,
					config.bankId,
					config.steps.topTags.limit,
				),
			);
			for (const t of tags) console.log(`${t.tag} (${t.count})`);
			break;
		}
		case "top-entities": {
			const entities = await import("../src/client.js").then((m) =>
				m.fetchTopEntities(
					config.baseUrl,
					config.apiKey,
					config.bankId,
					config.steps.topEntities.limit,
				),
			);
			for (const e of entities)
				console.log(`${e.canonical_name} (${e.mention_count})`);
			break;
		}
		case "hotspots": {
			const graph = await import("../src/client.js").then((m) =>
				m.fetchEntityGraph(
					config.baseUrl,
					config.apiKey,
					config.bankId,
					config.steps.hotspots.limit * 3,
				),
			);
			const spots = extractHotspots(graph, config.steps.hotspots);
			for (const h of spots) console.log(h.nodes.join(" ↔ "));
			break;
		}
		case "top-mental-models": {
			const models = await import("../src/client.js").then((m) =>
				m.fetchTopMentalModels(
					config.baseUrl,
					config.apiKey,
					config.bankId,
					config.steps.topMentalModels.limit,
				),
			);
			for (const m of models) console.log(m.name);
			break;
		}
		case "cache-clear": {
			const count = await cacheClear(config.cache);
			console.log(`Cleared ${count} cache entries`);
			break;
		}
		case "doctor": {
			console.log(`baseUrl: ${config.baseUrl}`);
			console.log(`bankId:  ${config.bankId}`);
			console.log(`apiKey:  ${config.apiKey ? "***" : "(none)"}`);
			console.log(
				`cache:   ${config.cache.dir} (TTL ${config.cache.ttlSeconds}s)`,
			);
			try {
				const healthController = new AbortController();
				const healthTimer = setTimeout(() => healthController.abort(), 10_000);
				try {
					const r = await fetch(`${config.baseUrl.replace(/\/$/, "")}/health`, {
						signal: healthController.signal,
					});
					console.log(`health:  ${r.ok ? "ok" : r.status}`);
				} finally {
					clearTimeout(healthTimer);
				}
			} catch (e: any) {
				console.log(`health:  FAIL (${e.message})`);
			}
			break;
		}
		default:
			console.error(`Unknown command: ${command}`);
			console.error(
				"Usage: hindsight-stats [cover|top-tags|top-entities|hotspots|top-mental-models|cache-clear|doctor]",
			);
			throw new Error(`Unknown command: ${command}`);
	}
};

run().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
