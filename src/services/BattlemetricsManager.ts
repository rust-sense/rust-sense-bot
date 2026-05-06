import type { IBattlemetricsRegistry } from '../interfaces/IBattlemetricsRegistry.js';
import { getPersistenceService } from '../persistence/index.js';
import Battlemetrics from '../structures/Battlemetrics.js';

export class BattlemetricsManager implements IBattlemetricsRegistry {
    battlemetricsInstances: Record<string, Battlemetrics> = {};
    intervalId: ReturnType<typeof setInterval> | null = null;
    intervalCounter = 0;

    /**
     * Reconcile the set of active Battlemetrics instances against the current
     * guild configuration. Creates missing instances, updates stale ones, and
     * removes instances that are no longer referenced by any guild.
     */
    async updateInstances(guildIds: string[]): Promise<void> {
        const activeInstances: string[] = [];

        for (const guildId of guildIds) {
            const instance = await getPersistenceService().readGuildState(guildId);
            const activeServer = instance.activeServer;

            if (activeServer !== null && Object.hasOwn(instance.serverList, activeServer)) {
                const battlemetricsId = instance.serverList[activeServer].battlemetricsId;

                if (battlemetricsId !== null) {
                    if (!activeInstances.includes(battlemetricsId)) {
                        activeInstances.push(battlemetricsId);
                        if (Object.hasOwn(this.battlemetricsInstances, battlemetricsId)) {
                            await this.battlemetricsInstances[battlemetricsId].evaluation();
                        } else {
                            const bm = new Battlemetrics();
                            bm.id = battlemetricsId;
                            await bm.setup();
                            this.battlemetricsInstances[battlemetricsId] = bm;
                        }
                    }
                } else {
                    /* No ID — try to resolve by server name */
                    const bm = new Battlemetrics();
                    bm.id = null;
                    bm.name = instance.serverList[activeServer].title;
                    await bm.setup();

                    if (bm.lastUpdateSuccessful) {
                        instance.serverList[activeServer].battlemetricsId = bm.id;
                        await getPersistenceService().updateServerFields(guildId, activeServer, {
                            battlemetricsId: bm.id,
                        });

                        const resolvedId = bm.id as string;
                        if (Object.hasOwn(this.battlemetricsInstances, resolvedId)) {
                            if (!activeInstances.includes(resolvedId)) {
                                activeInstances.push(resolvedId);
                                await this.battlemetricsInstances[resolvedId].evaluation(bm.data);
                            }
                        } else {
                            activeInstances.push(resolvedId);
                            this.battlemetricsInstances[resolvedId] = bm;
                        }
                    }
                }
            }

            for (const [, content] of Object.entries(instance.trackers)) {
                const bmId = content.battlemetricsId;
                if (!activeInstances.includes(bmId)) {
                    activeInstances.push(bmId);
                    if (Object.hasOwn(this.battlemetricsInstances, bmId)) {
                        await this.battlemetricsInstances[bmId].evaluation();
                    } else {
                        const bm = new Battlemetrics();
                        bm.id = bmId;
                        await bm.setup();
                        this.battlemetricsInstances[bmId] = bm;
                    }
                }
            }
        }

        for (const id of Object.keys(this.battlemetricsInstances).filter((e) => !activeInstances.includes(e))) {
            delete this.battlemetricsInstances[id];
        }
    }

    resetIntervalCounter(): void {
        this.intervalCounter = 0;
    }

    incrementIntervalCounter(): void {
        if (this.intervalCounter === 29) {
            this.intervalCounter = 0;
        } else {
            this.intervalCounter += 1;
        }
    }
}
