import type RustPlusLite from '../structures/RustPlusLite.js';
import type { RustPlusLiteEventServices } from '../types/rustplusLiteEvents.js';

export default {
    name: 'connecting',
    execute(rustplusLite: RustPlusLite, services: RustPlusLiteEventServices) {
        rustplusLite.log(
            services.localizationService.intlGet(null, 'connectingCap'),
            services.localizationService.intlGet(null, 'connectingToServer'),
        );
    },
};
