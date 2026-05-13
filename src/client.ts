export interface TagItem {
	tag: string;
	count: number;
}

export interface EntityItem {
	id: string;
	canonical_name: string;
	mention_count: number;
	last_seen?: string;
}

export interface EntityGraphNode {
	id: string;
	canonical_name: string;
}

export interface EntityGraphEdge {
	source: string;
	target: string;
	weight: number;
}

export interface EntityGraph {
	nodes: EntityGraphNode[];
	edges: EntityGraphEdge[];
}

export interface MentalModelItem {
	id: string;
	name: string;
	last_refreshed_at?: string;
	tags?: string[];
}

export interface FetchResult {
	topTags: TagItem[];
	topEntities: EntityItem[];
	entityGraph: EntityGraph;
	topMentalModels: MentalModelItem[];
}

const authHeaders = (apiKey?: string): Record<string, string> => ({
	"Content-Type": "application/json",
	...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
});

const FETCH_TIMEOUT_MS = 30_000; // 30 seconds

const apiGet = async (
	baseUrl: string,
	apiKey: string | undefined,
	path: string,
	timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<any | null> => {
	const url = `${baseUrl.replace(/\/$/, "")}${path}`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, {
			method: "GET",
			headers: authHeaders(apiKey),
			signal: controller.signal,
		});
		if (!response.ok) {
			if (response.status === 404) return null;
			throw new Error(
				`GET ${path} failed: ${response.status} ${response.statusText}`,
			);
		}
		return response.json();
	} finally {
		clearTimeout(timer);
	}
};

export const fetchTopTags = async (
	baseUrl: string,
	apiKey: string | undefined,
	bankId: string,
	limit: number,
): Promise<TagItem[]> => {
	const result = await apiGet(
		baseUrl,
		apiKey,
		`/v1/default/banks/${encodeURIComponent(bankId)}/tags?limit=${limit}`,
	);
	if (!result) return [];
	return Array.isArray(result?.items)
		? result.items.map((i: any) => ({ tag: i.tag, count: i.count }))
		: [];
};

export const fetchTopEntities = async (
	baseUrl: string,
	apiKey: string | undefined,
	bankId: string,
	limit: number,
): Promise<EntityItem[]> => {
	const result = await apiGet(
		baseUrl,
		apiKey,
		`/v1/default/banks/${encodeURIComponent(bankId)}/entities?limit=${limit}`,
	);
	if (!result) return [];
	return Array.isArray(result?.items)
		? result.items.map((i: any) => ({
				id: i.id,
				canonical_name: i.canonical_name,
				mention_count: i.mention_count,
				last_seen: i.last_seen,
			}))
		: [];
};

export const fetchEntityGraph = async (
	baseUrl: string,
	apiKey: string | undefined,
	bankId: string,
	limit: number,
): Promise<EntityGraph> => {
	const result = await apiGet(
		baseUrl,
		apiKey,
		`/v1/default/banks/${encodeURIComponent(bankId)}/entities/graph?limit=${limit}`,
	);
	if (!result) return { nodes: [], edges: [] };
	return {
		nodes: Array.isArray(result?.nodes)
			? result.nodes.map((n: any) => ({
					id: n.id ?? n,
					canonical_name: n.canonical_name ?? n,
				}))
			: [],
		edges: Array.isArray(result?.edges)
			? result.edges.map((e: any) => ({
					source: e.source,
					target: e.target,
					weight: e.weight ?? 1,
				}))
			: [],
	};
};

export const fetchTopMentalModels = async (
	baseUrl: string,
	apiKey: string | undefined,
	bankId: string,
	limit: number,
): Promise<MentalModelItem[]> => {
	const result = await apiGet(
		baseUrl,
		apiKey,
		`/v1/default/banks/${encodeURIComponent(bankId)}/mental-models?limit=${limit}&detail=metadata`,
	);
	if (!result) return [];
	const items = Array.isArray(result?.items)
		? result.items
		: Array.isArray(result)
			? result
			: [];
	return items.map((i: any) => ({
		id: i.id,
		name: i.name,
		last_refreshed_at: i.last_refreshed_at,
		tags: Array.isArray(i.tags) ? i.tags : [],
	}));
};

export const fetchAllStats = async (
	baseUrl: string,
	apiKey: string | undefined,
	bankId: string,
	limits: {
		tags: number;
		entities: number;
		graph: number;
		mentalModels: number;
	},
): Promise<FetchResult> => {
	const [topTags, topEntities, entityGraph, topMentalModels] =
		await Promise.all([
			fetchTopTags(baseUrl, apiKey, bankId, limits.tags),
			fetchTopEntities(baseUrl, apiKey, bankId, limits.entities),
			fetchEntityGraph(baseUrl, apiKey, bankId, limits.graph),
			fetchTopMentalModels(baseUrl, apiKey, bankId, limits.mentalModels),
		]);
	return { topTags, topEntities, entityGraph, topMentalModels };
};
