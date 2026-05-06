import type { ILocalizationService } from '../interfaces/ILocalizationService.js';
import type { IRustPlusManagerClient } from '../interfaces/IRustPlusManagerClient.js';
import { RustPlus as RustPlusLib } from '../lib/rustplus/RustPlus.js';
import rustplusLiteEvents from '../rustplusLiteEvents/index.js';
import type { RustplusLiteEvent } from '../types/rustplusLiteEvents.js';
import LibLoggerAdapter from './LibLoggerAdapter.js';

interface LoggerLike {
    log: (title: string, text: string, level: string) => void;
}

interface RustplusLike {
    serverId: string;
    updateLeaderRustPlusLiteInstance(): Promise<void>;
}

export default class RustPlusLite extends RustPlusLib {
    serverId: string;
    guildId: string;
    logger: LoggerLike;
    rustplus: RustplusLike;
    isActive = true;
    _reconnectAttempts = 0;

    private readonly _localization: ILocalizationService;
    private readonly _manager: IRustPlusManagerClient;

    constructor(
        guildId: string,
        logger: LoggerLike,
        rustplus: RustplusLike,
        serverIp: string,
        appPort: number,
        steamId: string,
        playerToken: string,
        localizationService: ILocalizationService,
        manager: IRustPlusManagerClient,
    ) {
        super(serverIp, appPort, steamId, playerToken, false, new LibLoggerAdapter(logger, 'RustPlus LITE'));

        this.serverId = `${this.server}-${this.port}`;
        this.guildId = guildId;
        this.logger = logger;
        this.rustplus = rustplus;
        this._localization = localizationService;
        this._manager = manager;

        this.loadRustPlusLiteEvents();
    }

    loadRustPlusLiteEvents(): void {
        const services = { localizationService: this._localization, manager: this._manager };
        for (const event of rustplusLiteEvents as RustplusLiteEvent[]) {
            this.on(event.name, (...args: unknown[]) => event.execute(this, services, ...args));
        }
    }

    log(title: string, text: string, level = 'info'): void {
        this.logger.log(`${title} LITE`, text, level);
    }

    async getInfoAsync(timeout = 10000): Promise<unknown> {
        try {
            return await this.sendRequestAsync(
                {
                    getInfo: {},
                },
                timeout,
            ).catch((e: unknown) => {
                return e;
            });
        } catch (e) {
            return e;
        }
    }

    async promoteToLeaderAsync(steamId: string, timeout = 10000): Promise<unknown> {
        try {
            return await this.sendRequestAsync(
                {
                    promoteToLeader: {
                        steamId,
                    },
                },
                timeout,
            ).catch((e: unknown) => {
                return e;
            });
        } catch (e) {
            return e;
        }
    }

    isResponseValid(response: unknown): boolean {
        if (response === undefined) {
            this.log(this._localization.intlGet(null, 'errorCap'), this._localization.intlGet(null, 'responseIsUndefined'), 'error');
            return false;
        }

        if (response?.toString() === 'Error: Timeout reached while waiting for response') {
            this.log(this._localization.intlGet(null, 'errorCap'), this._localization.intlGet(null, 'responseTimeout'), 'error');
            return false;
        }

        if (Object.hasOwn(response as object, 'error')) {
            const errorResponse = response as { error: string };
            if (errorResponse.error === 'not_found') {
                return false;
            }

            this.log(
                this._localization.intlGet(null, 'errorCap'),
                this._localization.intlGet(null, 'responseContainError', {
                    error: errorResponse.error,
                }),
                'error',
            );
            return false;
        }

        return true;
    }
}
