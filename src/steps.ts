import type {
	EntityGraph,
	EntityItem,
	MentalModelItem,
	TagItem,
} from "./client.js";
import type { StatsConfig, StepConfig } from "./config.js";

// --- Level grouping ---

export const groupToLevel = (tag: string, level: number): string => {
	const parts = tag.split(":");
	if (parts.length <= level) return tag;
	return parts.slice(0, level).join(":");
};

export const groupTags = (tags: TagItem[], level?: number): TagItem[] => {
	if (!level || level <= 0) return tags;
	const map = new Map<string, number>();
	for (const t of tags) {
		const key = groupToLevel(t.tag, level);
		map.set(key, (map.get(key) ?? 0) + t.count);
	}
	return [...map.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count);
};

// --- Ranking ---

export const rankTags = (tags: TagItem[], config: StepConfig): TagItem[] => {
	const grouped = groupTags(tags, config.level);
	return grouped.slice(0, config.limit);
};

export const rankEntities = (
	entities: EntityItem[],
	config: StepConfig,
): EntityItem[] =>
	[...entities]
		.sort((a, b) => b.mention_count - a.mention_count)
		.slice(0, config.limit);

export const rankMentalModels = (
	models: MentalModelItem[],
	config: StepConfig,
): MentalModelItem[] =>
	[...models]
		.filter((m) => Boolean(m.name))
		.sort((a, b) => {
			const aTime = a.last_refreshed_at
				? new Date(a.last_refreshed_at).getTime()
				: 0;
			const bTime = b.last_refreshed_at
				? new Date(b.last_refreshed_at).getTime()
				: 0;
			return bTime - aTime;
		})
		.slice(0, config.limit);

// --- Hotspots ---

export interface HotspotChain {
	nodes: string[];
	weight: number;
}

export const extractHotspots = (
	graph: EntityGraph,
	config: StepConfig & { chainSize?: number },
): HotspotChain[] => {
	const nodeNames = new Map<string, string>();
	for (const n of graph.nodes) {
		nodeNames.set(n.id, n.canonical_name);
	}

	// Build adjacency with weights
	const adj = new Map<string, Map<string, number>>();
	for (const e of graph.edges) {
		if (!adj.has(e.source)) adj.set(e.source, new Map());
		adj
			.get(e.source)!
			.set(e.target, (adj.get(e.source)!.get(e.target) ?? 0) + e.weight);
		if (!adj.has(e.target)) adj.set(e.target, new Map());
		adj
			.get(e.target)!
			.set(e.source, (adj.get(e.target)!.get(e.source) ?? 0) + e.weight);
	}

	// Degree per node
	const degree = new Map<string, number>();
	for (const [id, neighbors] of adj) {
		degree.set(id, neighbors.size);
	}

	// Sort nodes by degree desc
	const sorted = [...degree.entries()].sort((a, b) => b[1] - a[1]);

	const chains: HotspotChain[] = [];
	const seen = new Set<string>();

	for (const [nodeId] of sorted) {
		if (seen.has(nodeId)) continue;
		if (chains.length >= config.limit) break;

		const neighbors = adj.get(nodeId);
		if (!neighbors || neighbors.size < 1) continue;

		// Pick top-weighted neighbors
		const topNeighbors = [...neighbors.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, (config.chainSize ?? 3) - 1);

		const chainIds = [nodeId, ...topNeighbors.map(([id]) => id)];
		const names = chainIds.map((id) => nodeNames.get(id) ?? id);
		const totalWeight = topNeighbors.reduce((sum, [, w]) => sum + w, 0);

		for (const id of chainIds) seen.add(id);
		chains.push({ nodes: names, weight: totalWeight });
	}

	return chains;
};

// --- Render ---

export const renderTags = (tags: TagItem[], maxTokens: number): string => {
	if (tags.length === 0) return "";
	const lines = tags.map((t) => `- ${t.tag} (${t.count})`);
	return truncateBlock("[Top Tags]", lines, maxTokens);
};

export const renderEntities = (
	entities: EntityItem[],
	maxTokens: number,
): string => {
	if (entities.length === 0) return "";
	const lines = entities.map(
		(e) => `- ${e.canonical_name} (${e.mention_count})`,
	);
	return truncateBlock("[Top Entities]", lines, maxTokens);
};

export const renderHotspots = (
	hotspots: HotspotChain[],
	maxTokens: number,
): string => {
	if (hotspots.length === 0) return "";
	const lines = hotspots.map((h) => `- ${h.nodes.join(" ↔ ")}`);
	return truncateBlock("[Hotspots]", lines, maxTokens);
};

export const renderMentalModels = (
	models: MentalModelItem[],
	maxTokens: number,
): string => {
	if (models.length === 0) return "";
	const lines = models.map((m) => `- ${m.name}`);
	return truncateBlock("[Top Mental Models]", lines, maxTokens);
};

const truncateBlock = (
	header: string,
	lines: string[],
	maxTokens: number,
): string => {
	// Rough token estimate: ~4 chars per token
	const maxChars = maxTokens * 4;
	let output = `${header}\n`;
	for (const line of lines) {
		if (output.length + line.length + 1 > maxChars) break;
		output += `${line}\n`;
	}
	return output.trimEnd();
};

export const renderCover = (
	stats: {
		topTags: TagItem[];
		topEntities: EntityItem[];
		hotspots: HotspotChain[];
		topMentalModels: MentalModelItem[];
	},
	config: StatsConfig,
): string => {
	const parts: string[] = [];
	const steps = config.steps;

	if (steps.topTags.enabled) {
		const ranked = rankTags(stats.topTags, steps.topTags);
		const rendered = renderTags(ranked, steps.topTags.maxTokens);
		if (rendered) parts.push(rendered);
	}
	if (steps.topEntities.enabled) {
		const ranked = rankEntities(stats.topEntities, steps.topEntities);
		const rendered = renderEntities(ranked, steps.topEntities.maxTokens);
		if (rendered) parts.push(rendered);
	}
	if (steps.hotspots.enabled) {
		// Need entityGraph to extract hotspots — caller should pre-extract
		// For now, render pre-extracted hotspots
		const rendered = renderHotspots(stats.hotspots, steps.hotspots.maxTokens);
		if (rendered) parts.push(rendered);
	}
	if (steps.topMentalModels.enabled) {
		const ranked = rankMentalModels(
			stats.topMentalModels,
			steps.topMentalModels,
		);
		const rendered = renderMentalModels(
			ranked,
			steps.topMentalModels.maxTokens,
		);
		if (rendered) parts.push(rendered);
	}

	const full = parts.join("\n\n");
	const maxChars = config.render.totalMaxTokens * 4;
	if (full.length > maxChars) return full.slice(0, maxChars);
	return full;
};
