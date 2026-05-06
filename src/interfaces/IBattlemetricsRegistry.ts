import type Battlemetrics from '../structures/Battlemetrics.js';

export interface IBattlemetricsRegistry {
    battlemetricsInstances: Record<string, Battlemetrics>;
}
