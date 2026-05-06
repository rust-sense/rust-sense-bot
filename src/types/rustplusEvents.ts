import type { ILocalizationService } from '../interfaces/ILocalizationService.js';
import type { IRustPlusManagerClient } from '../interfaces/IRustPlusManagerClient.js';
import type RustPlus from '../structures/RustPlus.js';

export interface RustPlusEventServices {
    localizationService: ILocalizationService;
    manager: IRustPlusManagerClient;
}

export interface RustplusEvent {
    name: string;
    execute(rustplus: RustPlus, services: RustPlusEventServices, ...args: unknown[]): Promise<void> | void;
}
