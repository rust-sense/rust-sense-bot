import type RustPlus from '../structures/RustPlus.js';
import type { RustPlusEventServices } from '../types/rustplusEvents.js';

export default {
    name: 'connecting',
    execute(rustplus: RustPlus, services: RustPlusEventServices) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        rustplus.log(
            services.localizationService.intlGet(null, 'connectingCap'),
            services.localizationService.intlGet(null, 'connectingToServer'),
        );
    },
};
