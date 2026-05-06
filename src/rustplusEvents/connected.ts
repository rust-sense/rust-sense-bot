import * as DiscordMessages from '../discordTools/discordMessages.js';
import { getPersistenceService } from '../persistence/index.js';
import * as PollingHandlerModule from '../services/pollingService.js';
import type RustPlus from '../structures/RustPlus.js';
import type { RustPlusEventServices } from '../types/rustplusEvents.js';
import { resolve } from '../container.js';

const PollingHandler = PollingHandlerModule;

export default {
    name: 'connected',
    async execute(rustplus: RustPlus, services: RustPlusEventServices) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        rustplus.log(
            services.localizationService.intlGet(null, 'connectedCap'),
            services.localizationService.intlGet(null, 'connectedToServer'),
        );

        const instance = await getPersistenceService().readGuildState(rustplus.guildId);
        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;

        rustplus.uptimeServer = new Date();

        /* Start the token replenish task */
        rustplus.tokensReplenishTaskId = setInterval(rustplus.replenishTokens.bind(rustplus), 1000);

        /* Request the map. Act as a check to see if connection is truly operational. */
        const map = await rustplus.getMapAsync(3 * 60 * 1000); /* 3 min timeout */
        if (!rustplus.isResponseValid(map)) {
            rustplus.log(
                services.localizationService.intlGet(null, 'errorCap'),
                services.localizationService.intlGet(null, 'somethingWrongWithConnection'),
                'error',
            );

            instance.activeServer = null;
            await getPersistenceService().updateGuildCoreFields(guildId, { activeServer: null });

            await DiscordMessages.sendServerConnectionInvalidMessage(guildId, serverId);
            await DiscordMessages.sendServerMessage(guildId, serverId, null);

            services.manager.resetRustplusVariables(guildId);

            rustplus.disconnect();
            delete services.manager.rustplusInstances[guildId];
            return;
        }
        rustplus.log(
            services.localizationService.intlGet(null, 'connectedCap'),
            services.localizationService.intlGet(null, 'rustplusOperational'),
        );

        const info = await rustplus.getInfoAsync();
        if (rustplus.isResponseValid(info) && info.info) {
            const { default: Info } = await import('../structures/Info.js');
            rustplus.info = new Info(info.info);
        }

        const { default: GameMap } = await import('../structures/GameMap.js');
        if (Object.hasOwn(services.manager.rustplusMaps, guildId)) {
            if (services.manager.isJpgImageChanged(guildId, map.map)) {
                rustplus.map = new GameMap(map.map, rustplus);

                await rustplus.map.writeMap(false, true);
                await DiscordMessages.sendServerWipeDetectedMessage(guildId, serverId);
                await DiscordMessages.sendInformationMapMessage(guildId);
            } else {
                rustplus.map = new GameMap(map.map, rustplus);

                await rustplus.map.writeMap(false, true);
                await DiscordMessages.sendInformationMapMessage(guildId);
            }
        } else {
            rustplus.map = new GameMap(map.map, rustplus);

            await rustplus.map.writeMap(false, true);
            await DiscordMessages.sendInformationMapMessage(guildId);
        }

        if (services.manager.rustplusReconnecting[guildId]) {
            services.manager.rustplusReconnecting[guildId] = false;
            rustplus._reconnectAttempts = 0;

            if (services.manager.rustplusReconnectTimers[guildId]) {
                clearTimeout(services.manager.rustplusReconnectTimers[guildId]);
                services.manager.rustplusReconnectTimers[guildId] = null;
            }

            await DiscordMessages.sendServerChangeStateMessage(guildId, serverId, 0);
        }

        await DiscordMessages.sendServerMessage(guildId, serverId, null);

        /* Setup Smart Devices — these still need the full DiscordBot (Phase 6) */
        const discordBot = resolve('discordBot');
        await (await import('../discordTools/SetupSwitches.js')).default(discordBot, rustplus);
        await (await import('../discordTools/SetupSwitchGroups.js')).default(discordBot, rustplus);
        await (await import('../discordTools/SetupAlarms.js')).default(discordBot, rustplus);
        await (await import('../discordTools/SetupStorageMonitors.js')).default(discordBot, rustplus);
        rustplus.isNewConnection = false;
        rustplus.loadMarkers();

        await PollingHandler.pollRustPlusState(rustplus, discordBot);
        rustplus.restorePersistentRuntimeState();
        rustplus.persistMapMarkersRuntimeState();
        rustplus.pollingTaskId = setInterval(
            PollingHandler.pollRustPlusState,
            services.manager.pollingIntervalMs,
            rustplus,
            discordBot,
        );
        rustplus.isOperational = true;

        rustplus.updateLeaderRustPlusLiteInstance();
    },
};
