import type RustPlus from '../structures/RustPlus.js';

export interface IRustPlusManagerClient {
    rustplusInstances: Record<string, RustPlus>;
    activeRustplusInstances: Record<string, boolean>;
    rustplusReconnecting: Record<string, boolean>;
    rustplusReconnectTimers: Record<string, ReturnType<typeof setTimeout> | null>;
    rustplusLiteReconnectTimers: Record<string, ReturnType<typeof setTimeout> | null>;
    rustplusMaps: Record<string, unknown>;
    pollingIntervalMs: number;
    createRustplusInstance(
        guildId: string,
        serverIp: string,
        appPort: number,
        steamId: string,
        playerToken: string,
    ): RustPlus;
    resetRustplusVariables(guildId: string): void;
    isJpgImageChanged(guildId: string, map: unknown): boolean;
}
