import type RustPlus from '../structures/RustPlus.js';
import type { RustPlusEventServices } from '../types/rustplusEvents.js';

export default {
    name: 'request',
    execute(rustplus: RustPlus, _services: RustPlusEventServices, _request: unknown) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        /* Not used */
    },
};
