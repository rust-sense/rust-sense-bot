import type RustPlusLite from '../structures/RustPlusLite.js';
import type { RustPlusLiteEventServices } from '../types/rustplusLiteEvents.js';

export default {
    name: 'connected',
    async execute(rustplusLite: RustPlusLite, services: RustPlusLiteEventServices) {
        rustplusLite.log(
            services.localizationService.intlGet(null, 'connectedCap'),
            services.localizationService.intlGet(null, 'connectedToServer'),
        );

        const info = await rustplusLite.getInfoAsync();
        if (!rustplusLite.isResponseValid(info)) {
            rustplusLite.log(
                services.localizationService.intlGet(null, 'errorCap'),
                services.localizationService.intlGet(null, 'somethingWrongWithConnection'),
                'error',
            );
            rustplusLite.disconnect();
            return;
        }
        rustplusLite.log(
            services.localizationService.intlGet(null, 'connectedCap'),
            services.localizationService.intlGet(null, 'rustplusOperational'),
        );

        rustplusLite._reconnectAttempts = 0;

        if (services.manager.rustplusLiteReconnectTimers[rustplusLite.guildId]) {
            clearTimeout(services.manager.rustplusLiteReconnectTimers[rustplusLite.guildId]);
            services.manager.rustplusLiteReconnectTimers[rustplusLite.guildId] = null;
        }
    },
};
