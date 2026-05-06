import type { IBattlemetricsRegistry } from '../interfaces/IBattlemetricsRegistry.js';
import type { IDiscordNotifier } from '../interfaces/IDiscordNotifier.js';
import type { IGameDataProvider } from '../interfaces/IGameDataProvider.js';
import type { ILocalizationService } from '../interfaces/ILocalizationService.js';
import type { IRustPlusManagerClient } from '../interfaces/IRustPlusManagerClient.js';
import getRuntimeDataStorage from '../infrastructure/getRuntimeDataStorage.js';
import { getPersistenceService } from '../persistence/index.js';
import RustPlus, { type RustPlusDeps } from './RustPlus.js';

export class RustPlusManager implements IRustPlusManagerClient {
    rustplusInstances: Record<string, RustPlus> = {};
    activeRustplusInstances: Record<string, boolean> = {};
    rustplusReconnectTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};
    rustplusLiteReconnectTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};
    rustplusReconnecting: Record<string, boolean> = {};
    rustplusMaps: Record<string, unknown> = {};
    pollingIntervalMs: number;

    constructor(
        private readonly _localizationService: ILocalizationService,
        private readonly _gameDataProvider: IGameDataProvider,
        private readonly _battlemetricsManager: IBattlemetricsRegistry,
        private readonly _discordNotifier: IDiscordNotifier,
        pollingIntervalMs: number,
    ) {
        this.pollingIntervalMs = pollingIntervalMs;
    }

    createRustplusInstance(
        guildId: string,
        serverIp: string,
        appPort: number,
        steamId: string,
        playerToken: string,
    ): RustPlus {
        const deps: RustPlusDeps = {
            localizationService: this._localizationService,
            gameDataProvider: this._gameDataProvider,
            battlemetricsManager: this._battlemetricsManager,
            discordNotifier: this._discordNotifier,
            manager: this,
            runtimeDataStorage: getRuntimeDataStorage(),
        };
        const rustplus = new RustPlus(guildId, serverIp, appPort, steamId, playerToken, deps);
        this.rustplusInstances[guildId] = rustplus;
        this.activeRustplusInstances[guildId] = true;
        rustplus.build();
        return rustplus;
    }

    async createRustplusInstancesFromConfig(): Promise<void> {
        for (const guildId of await getPersistenceService().listGuildIds()) {
            const instance = await getPersistenceService().readGuildState(guildId);
            if (!instance) continue;

            if (instance.activeServer !== null && Object.hasOwn(instance.serverList, instance.activeServer)) {
                this.createRustplusInstance(
                    guildId,
                    instance.serverList[instance.activeServer].serverIp,
                    instance.serverList[instance.activeServer].appPort,
                    instance.serverList[instance.activeServer].steamId,
                    instance.serverList[instance.activeServer].playerToken,
                );
            }
        }
    }

    deleteGuildInstances(guildId: string): void {
        this.rustplusInstances[guildId]?.deleteThisRustplusInstance();
        delete this.rustplusInstances[guildId];
        delete this.activeRustplusInstances[guildId];
        delete this.rustplusReconnecting[guildId];
        delete this.rustplusMaps[guildId];

        if (this.rustplusReconnectTimers[guildId]) {
            clearTimeout(this.rustplusReconnectTimers[guildId]);
        }
        delete this.rustplusReconnectTimers[guildId];

        if (this.rustplusLiteReconnectTimers[guildId]) {
            clearTimeout(this.rustplusLiteReconnectTimers[guildId]);
        }
        delete this.rustplusLiteReconnectTimers[guildId];
    }

    resetRustplusVariables(guildId: string): void {
        this.activeRustplusInstances[guildId] = false;
        this.rustplusReconnecting[guildId] = false;
        delete this.rustplusMaps[guildId];

        if (this.rustplusReconnectTimers[guildId]) {
            clearTimeout(this.rustplusReconnectTimers[guildId]);
            this.rustplusReconnectTimers[guildId] = null;
        }

        if (this.rustplusLiteReconnectTimers[guildId]) {
            clearTimeout(this.rustplusLiteReconnectTimers[guildId]);
            this.rustplusLiteReconnectTimers[guildId] = null;
        }
    }

    isJpgImageChanged(guildId: string, map: unknown): boolean {
        return JSON.stringify(this.rustplusMaps[guildId]) !== JSON.stringify((map as any).jpgImage);
    }
}
