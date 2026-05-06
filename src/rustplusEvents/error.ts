import * as DiscordMessages from '../discordTools/discordMessages.js';
import type RustPlus from '../structures/RustPlus.js';
import type { RustPlusEventServices } from '../types/rustplusEvents.js';

export default {
    name: 'error',
    async execute(rustplus: RustPlus, services: RustPlusEventServices, err: any) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        rustplus.log(services.localizationService.intlGet(null, 'errorCap'), err, 'error');

        switch (err.code) {
            case 'ETIMEDOUT':
                errorTimedOut(rustplus, services, err);
                break;

            case 'ENOTFOUND':
                errorNotFound(rustplus, services, err);
                break;

            case 'ECONNREFUSED':
                await errorConnRefused(rustplus, services, err);
                break;

            default:
                errorOther(rustplus, services, err);
                break;
        }
    },
};

function errorTimedOut(rustplus: RustPlus, services: RustPlusEventServices, err: any) {
    if (err.syscall === 'connect') {
        rustplus.log(
            services.localizationService.intlGet(null, 'errorCap'),
            services.localizationService.intlGet(null, 'couldNotConnectTo', { id: rustplus.serverId }),
            'error',
        );
    }
}

function errorNotFound(rustplus: RustPlus, services: RustPlusEventServices, err: any) {
    if (err.syscall === 'getaddrinfo') {
        rustplus.log(
            services.localizationService.intlGet(null, 'errorCap'),
            services.localizationService.intlGet(null, 'couldNotConnectTo', { id: rustplus.serverId }),
            'error',
        );
    }
}

async function errorConnRefused(rustplus: RustPlus, services: RustPlusEventServices, err: any) {
    rustplus.log(
        services.localizationService.intlGet(null, 'errorCap'),
        services.localizationService.intlGet(null, 'connectionRefusedTo', { id: rustplus.serverId }),
        'error',
    );
}

function errorOther(rustplus: RustPlus, services: RustPlusEventServices, err: any) {
    if (err.toString() === 'Error: WebSocket was closed before the connection was established') {
        rustplus.log(
            services.localizationService.intlGet(null, 'errorCap'),
            services.localizationService.intlGet(null, 'websocketClosedBeforeConnection'),
            'error',
        );
    }
}
