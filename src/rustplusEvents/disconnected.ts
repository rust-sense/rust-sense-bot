import config from '../config.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import type RustPlus from '../structures/RustPlus.js';
import type { RustPlusEventServices } from '../types/rustplusEvents.js';

export default {
    name: 'disconnected',
    async execute(rustplus: RustPlus, services: RustPlusEventServices) {
        if (!rustplus.isServerAvailable() && !rustplus.isDeleted) {
            rustplus.deleteThisRustplusInstance();
        }

        rustplus.log(
            services.localizationService.intlGet(null, 'disconnectedCap'),
            services.localizationService.intlGet(null, 'disconnectedFromServer'),
        );

        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;

        if (rustplus.leaderRustPlusInstance !== null) {
            if (services.manager.rustplusLiteReconnectTimers[guildId]) {
                clearTimeout(services.manager.rustplusLiteReconnectTimers[guildId]);
                services.manager.rustplusLiteReconnectTimers[guildId] = null;
            }
            rustplus.leaderRustPlusInstance.isActive = false;
            rustplus.leaderRustPlusInstance.removeAllListeners();
            rustplus.leaderRustPlusInstance.disconnect();
            rustplus.leaderRustPlusInstance = null;
        }

        /* Stop current tasks */
        clearInterval(rustplus.pollingTaskId);
        clearInterval(rustplus.tokensReplenishTaskId);
        clearTimeout(rustplus.inGameChatTimeout);

        /* Reset map markers, timers & arrays */
        if (rustplus.mapMarkers) rustplus.mapMarkers.reset();

        /* Stop all custom timers */
        for (const [, timer] of Object.entries(rustplus.timers as Record<string, { timer: { stop: () => void } }>))
            timer.timer.stop();

        if (rustplus.isDeleted) return;

        /* Was the disconnection unexpected? */
        if (services.manager.activeRustplusInstances[guildId]) {
            if (!services.manager.rustplusReconnecting[guildId]) {
                await DiscordMessages.sendServerChangeStateMessage(guildId, serverId, 1);
                await DiscordMessages.sendServerMessage(guildId, serverId, 2);
            }

            services.manager.rustplusReconnecting[guildId] = true;

            const attempt = ++rustplus._reconnectAttempts;
            const delay = Math.min(config.general.reconnectIntervalMs * Math.pow(2, attempt - 1), 300000);

            rustplus.log(
                services.localizationService.intlGet(null, 'reconnectingCap'),
                `${services.localizationService.intlGet(null, 'reconnectingToServer')} (attempt ${attempt}, delay ${delay / 1000}s)`,
            );

            delete services.manager.rustplusInstances[guildId];

            if (services.manager.rustplusReconnectTimers[guildId]) {
                clearTimeout(services.manager.rustplusReconnectTimers[guildId]);
                services.manager.rustplusReconnectTimers[guildId] = null;
            }

            services.manager.rustplusReconnectTimers[guildId] = setTimeout(
                services.manager.createRustplusInstance.bind(services.manager),
                delay,
                guildId,
                rustplus.server,
                rustplus.port,
                rustplus.playerId,
                rustplus.playerToken,
            );
        }
    },
};
