import type { ILocalizationService } from '../interfaces/ILocalizationService.js';
import type { IRustPlusManagerClient } from '../interfaces/IRustPlusManagerClient.js';
import type RustPlusLite from '../structures/RustPlusLite.js';

export interface RustPlusLiteEventServices {
    localizationService: ILocalizationService;
    manager: IRustPlusManagerClient;
}

export interface RustplusLiteEvent {
    name: string;
    execute(rustplusLite: RustPlusLite, services: RustPlusLiteEventServices, ...args: unknown[]): Promise<void> | void;
}
