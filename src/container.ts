import type { AwilixContainer } from 'awilix';
import { asClass, asValue, createContainer } from 'awilix';

// Populated incrementally as services are registered.
// New keys are added here as each phase of the refactor lands.
export interface Cradle {
    discordBot: import('./structures/DiscordBot.js').default;
    localizationService: import('./services/LocalizationService.js').LocalizationService;
    gameDataProvider: import('./services/GameDataProvider.js').GameDataProvider;
    battlemetricsManager: import('./services/BattlemetricsManager.js').BattlemetricsManager;
    discordNotifier: import('./services/DiscordNotifier.js').DiscordNotifier;
    rustPlusManager: import('./structures/RustPlusManager.js').RustPlusManager;
}

export const container: AwilixContainer = createContainer({
    injectionMode: 'PROXY',
});

export function registerSingleton<T>(name: string, instance: T): void {
    container.register({
        [name]: asValue(instance),
    });
}

export function registerClass<T>(name: string, Class: new (...args: any[]) => T): void {
    container.register({
        [name]: asClass(Class).singleton(),
    });
}

// Typed overload for known Cradle keys; generic fallback for legacy callers.
export function resolve<K extends keyof Cradle>(name: K): Cradle[K];
export function resolve<T>(name: string): T;
export function resolve(name: string): unknown {
    return container.resolve(name);
}
