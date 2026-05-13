export interface StepConfig {
	enabled: boolean;
	limit: number;
	maxTokens: number;
	level?: number;
}

export interface CacheConfig {
	dir: string;
	ttlSeconds: number;
	serveStaleOnError: boolean;
}

export interface RenderConfig {
	totalMaxTokens: number;
	compact: boolean;
}

export interface StatsConfig {
	enabled: boolean;
	baseUrl: string;
	apiKey?: string;
	bankId: string;
	injectOnSessionStart: boolean;
	showStatusMessage: boolean;
	cache: CacheConfig;
	steps: {
		topTags: StepConfig;
		topEntities: StepConfig;
		hotspots: StepConfig & { chainSize?: number };
		topMentalModels: StepConfig;
	};
	render: RenderConfig;
}

export const DEFAULT_STEP: Omit<StepConfig, "maxTokens"> = {
	enabled: true,
	limit: 5,
};

const DEFAULT_CACHE: CacheConfig = {
	dir: "~/.hindsight/cache/stats",
	ttlSeconds: 600,
	serveStaleOnError: true,
};

const DEFAULT_RENDER: RenderConfig = {
	totalMaxTokens: 420,
	compact: true,
};

export const DEFAULT_CONFIG: StatsConfig = {
	enabled: true,
	baseUrl: "http://localhost:8888",
	bankId: "default",
	injectOnSessionStart: false,
	showStatusMessage: true,
	cache: DEFAULT_CACHE,
	steps: {
		topTags: { ...DEFAULT_STEP, maxTokens: 120, level: 2 },
		topEntities: { ...DEFAULT_STEP, maxTokens: 120 },
		hotspots: { ...DEFAULT_STEP, maxTokens: 160, level: 2, chainSize: 3 },
		topMentalModels: { ...DEFAULT_STEP, maxTokens: 120 },
	},
	render: DEFAULT_RENDER,
};

export const resolveStatsConfig = (
	partial?: Partial<StatsConfig>,
): StatsConfig => {
	if (!partial) return DEFAULT_CONFIG;
	return {
		...DEFAULT_CONFIG,
		...partial,
		cache: { ...DEFAULT_CACHE, ...partial.cache },
		render: { ...DEFAULT_RENDER, ...partial.render },
		steps: {
			topTags: { ...DEFAULT_CONFIG.steps.topTags, ...partial.steps?.topTags },
			topEntities: {
				...DEFAULT_CONFIG.steps.topEntities,
				...partial.steps?.topEntities,
			},
			hotspots: {
				...DEFAULT_CONFIG.steps.hotspots,
				...partial.steps?.hotspots,
			},
			topMentalModels: {
				...DEFAULT_CONFIG.steps.topMentalModels,
				...partial.steps?.topMentalModels,
			},
		},
	} as StatsConfig;
};
