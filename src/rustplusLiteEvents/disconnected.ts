import config from '../config.js';
import type RustPlusLite from '../structures/RustPlusLite.js';
import type { RustPlusLiteEventServices } from '../types/rustplusLiteEvents.js';

export default {
    name: 'disconnected',
    execute(rustplusLite: RustPlusLite, services: RustPlusLiteEventServices) {
        rustplusLite.log(
            services.localizationService.intlGet(null, 'disconnectedCap'),
            services.localizationService.intlGet(null, 'disconnectedFromServer'),
        );

        if (rustplusLite.isActive && services.manager.activeRustplusInstances[rustplusLite.guildId]) {
            const attempt = ++rustplusLite._reconnectAttempts;
            const delay = Math.min(config.general.reconnectIntervalMs * Math.pow(2, attempt - 1), 120000);

            rustplusLite.log(
                services.localizationService.intlGet(null, 'reconnectingCap'),
                `${services.localizationService.intlGet(null, 'reconnectingToServer')} (attempt ${attempt}, delay ${delay / 1000}s)`,
            );

            if (services.manager.rustplusLiteReconnectTimers[rustplusLite.guildId]) {
                clearTimeout(services.manager.rustplusLiteReconnectTimers[rustplusLite.guildId]);
                services.manager.rustplusLiteReconnectTimers[rustplusLite.guildId] = null;
            }

            services.manager.rustplusLiteReconnectTimers[rustplusLite.guildId] = setTimeout(
                rustplusLite.rustplus.updateLeaderRustPlusLiteInstance.bind(rustplusLite.rustplus),
                delay,
            );
        }
    },
};
