import type RustPlusLite from '../structures/RustPlusLite.js';
import type { RustPlusLiteEventServices } from '../types/rustplusLiteEvents.js';

export default {
    name: 'error',
    execute(rustplusLite: RustPlusLite, services: RustPlusLiteEventServices, error: any) {
        rustplusLite.log(services.localizationService.intlGet(null, 'errorCap'), error, 'error');
    },
};
