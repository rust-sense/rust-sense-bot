import fs from 'node:fs';
import path from 'node:path';
import * as Discord from 'discord.js';
import config from '../config.js';
import discordCommands from '../discordCommands/index.js';
import discordEvents from '../discordEvents/index.js';
import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import * as Constants from '../domain/constants.js';
import * as PermissionHandler from '../handlers/permissionHandler.js';
import { getPersistenceService } from '../persistence/index.js';
import type { BattlemetricsManager } from '../services/BattlemetricsManager.js';
import type { GameDataProvider } from '../services/GameDataProvider.js';
import type { LocalizationService } from '../services/LocalizationService.js';
import type Battlemetrics from '../structures/Battlemetrics.js';
import type Cctv from './Cctv.js';
import RustPlus from '../structures/RustPlus.js';
import type { RustPlusManager } from './RustPlusManager.js';
import type { DiscordEvent } from '../types/discord.js';
import type { Instance } from '../types/instance.js';
import { cwdPath } from '../utils/filesystemUtils.js';
import type Items from './Items.js';
import Logger from './Logger.js';
import type RustLabs from './RustLabs.js';

export interface DiscordBotServices {
    localizationService: LocalizationService;
    gameDataProvider: GameDataProvider;
    battlemetricsManager: BattlemetricsManager;
}

export default class DiscordBot extends Discord.Client {
    logger: Logger;
    commands: Discord.Collection<string, unknown>;
    fcmListeners: Record<string, { destroy: () => void }> = {};
    fcmListenersLite: Record<string, Record<string, { destroy: () => void }>> = {};
    uptimeBot: Date | null = null;
    pollingIntervalMs: number;
    voiceLeaveTimeouts: Record<string, ReturnType<typeof setTimeout> | null> = {};

    readonly localizationService: LocalizationService;
    readonly gameDataProvider: GameDataProvider;
    readonly battlemetricsManager: BattlemetricsManager;
    rustPlusManager!: RustPlusManager;

    /* Delegation getters — backward compat while callers migrate to direct service access */
    get items(): Items { return this.gameDataProvider.items; }
    get rustlabs(): RustLabs { return this.gameDataProvider.rustlabs; }
    get cctv(): Cctv { return this.gameDataProvider.cctv; }
    get battlemetricsInstances(): Record<string, Battlemetrics> { return this.battlemetricsManager.battlemetricsInstances; }
    get battlemetricsIntervalId() { return this.battlemetricsManager.intervalId; }
    set battlemetricsIntervalId(v: ReturnType<typeof setInterval> | null) { this.battlemetricsManager.intervalId = v; }
    get battlemetricsIntervalCounter() { return this.battlemetricsManager.intervalCounter; }
    set battlemetricsIntervalCounter(v: number) { this.battlemetricsManager.intervalCounter = v; }
    get rustplusInstances(): Record<string, RustPlus> { return this.rustPlusManager.rustplusInstances; }
    get activeRustplusInstances(): Record<string, boolean> { return this.rustPlusManager.activeRustplusInstances; }
    get rustplusReconnectTimers(): Record<string, ReturnType<typeof setTimeout> | null> { return this.rustPlusManager.rustplusReconnectTimers; }
    get rustplusLiteReconnectTimers(): Record<string, ReturnType<typeof setTimeout> | null> { return this.rustPlusManager.rustplusLiteReconnectTimers; }
    get rustplusReconnecting(): Record<string, boolean> { return this.rustPlusManager.rustplusReconnecting; }
    get rustplusMaps(): Record<string, unknown> { return this.rustPlusManager.rustplusMaps; }

    constructor(props: Discord.ClientOptions, services: DiscordBotServices) {
        super(props);

        this.logger = new Logger('discordBot.log');
        this.commands = new Discord.Collection();
        this.pollingIntervalMs = config.general.pollingIntervalMs;

        this.localizationService = services.localizationService;
        this.gameDataProvider = services.gameDataProvider;
        this.battlemetricsManager = services.battlemetricsManager;

        this.loadDiscordCommands();
        this.loadDiscordEvents();
    }

    loadDiscordCommands(): void {
        for (const command of discordCommands) {
            this.commands.set(command.name, command);
        }
    }

    loadDiscordEvents(): void {
        for (const event of discordEvents as DiscordEvent[]) {
            const handler = (...args: unknown[]) => event.execute(this, ...args);
            if (event.name === 'rateLimited') {
                this.rest.on(event.name, handler);
            } else if ((event as { once?: boolean }).once) {
                this.once(event.name, handler);
            } else {
                this.on(event.name, handler);
            }
        }
    }

    intlGet(guildId: string | null, id: string, variables: Record<string, unknown> = {}): string {
        return this.localizationService.intlGet(guildId, id, variables);
    }

    loadGuildIntl(guildId: string, instance: Instance): void {
        this.localizationService.loadGuildIntl(guildId, instance);
    }

    loadGuildCustomIntl(guildId: string, instance: Instance, key: string, message: string): void {
        this.localizationService.loadGuildCustomIntl(guildId, instance, key, message);
    }

    loadGuildsIntlFromCache(): void {
        const guildIds = [...this.guilds.cache.keys()];
        void this.localizationService.loadGuildsIntlFromGuildIds(guildIds);
    }

    checkLocaleIntlLoad(locale: string) {
        return this.localizationService.checkLocaleIntlLoad(locale);
    }

    removeCustomIntlKey(guildId: string, key: string): void {
        this.localizationService.removeCustomIntlKey(guildId, key);
    }

    build(): void {
        this.login(config.discord.token).catch((error: any) => {
            switch (error.code) {
                case 502:
                    {
                        this.log(
                            this.intlGet(null, 'errorCap'),
                            this.intlGet(null, 'badGateway', { error: JSON.stringify(error) }),
                            'error',
                        );
                    }
                    break;

                case 503:
                    {
                        this.log(
                            this.intlGet(null, 'errorCap'),
                            this.intlGet(null, 'serviceUnavailable', { error: JSON.stringify(error) }),
                            'error',
                        );
                    }
                    break;

                default:
                    {
                        this.log(this.intlGet(null, 'errorCap'), `${JSON.stringify(error)}`, 'error');
                    }
                    break;
            }
        });
    }

    log(title: string, text: string, level = 'info'): void {
        this.logger.log(title, text, level);
    }

    logInteraction(interaction: any, verifyId: string, type: string): void {
        const channel = DiscordTools.getTextChannelById(interaction.guildId, interaction.channelId);
        const args: Record<string, string> = {};
        args['guild'] = `${interaction.member.guild.name} (${interaction.member.guild.id})`;
        args['channel'] = `${channel?.name} (${interaction.channelId})`;
        args['user'] = `${interaction.user.username} (${interaction.user.id})`;
        args[type === 'slashCommand' ? 'command' : 'customid'] =
            type === 'slashCommand' ? `${interaction.commandName}` : `${interaction.customId}`;
        args['id'] = `${verifyId}`;

        this.log(this.intlGet(null, 'infoCap'), this.intlGet(null, `${type}Interaction`, args));
    }

    async setupGuild(guild: any): Promise<void> {
        const instance = await getPersistenceService().readGuildState(guild.id);
        const firstTime = instance.firstTime;

        const registerSlashCommands = (await import('../discordTools/RegisterSlashCommands.js')).default;
        await registerSlashCommands(this, guild);

        const setupGuildCategory = (await import('../discordTools/SetupGuildCategory.js')).default;
        const category = await setupGuildCategory(this, guild);

        const setupGuildChannels = (await import('../discordTools/SetupGuildChannels.js')).default;
        await setupGuildChannels(this, guild, category);

        if (firstTime) {
            const perms = await PermissionHandler.getPermissionsRemoved(this, guild);
            try {
                await category.permissionOverwrites.set(perms);
            } catch (e) {
                /* Ignore */
            }
        } else {
            await PermissionHandler.resetPermissionsAllChannels(this, guild);
        }

        const FcmListener = (await import('../infrastructure/FcmListener.js')).default;
        FcmListener(this, guild);

        const credentials = await getPersistenceService().getCredentials(guild.id);
        for (const steamId of Object.keys(credentials)) {
            if (steamId !== credentials.hoster && steamId !== 'hoster') {
                FcmListener(this, guild, steamId);
            }
        }

        const setupSettingsMenu = (await import('../discordTools/SetupSettingsMenu.js')).default;
        await setupSettingsMenu(this, guild);

        if (firstTime) await PermissionHandler.resetPermissionsAllChannels(this, guild);

        this.resetRustplusVariables(guild.id);
    }

    async syncCredentialsWithUsers(guild: any): Promise<void> {
        const credentials = await getPersistenceService().getCredentials(guild.id);

        const members = await guild.members.fetch();
        const memberIds: string[] = [];
        for (const member of members) {
            memberIds.push(member[0]);
        }

        const steamIdRemoveCredentials: string[] = [];
        for (const [steamId, content] of Object.entries(credentials)) {
            if (steamId === 'hoster') continue;
            if (typeof content !== 'object' || content === null) continue;

            if (!memberIds.includes((content as { discord_user_id: string }).discord_user_id)) {
                steamIdRemoveCredentials.push(steamId);
            }
        }

        for (const steamId of steamIdRemoveCredentials) {
            if (steamId === credentials.hoster) {
                if (this.fcmListeners[guild.id]) {
                    this.fcmListeners[guild.id].destroy();
                }
                delete this.fcmListeners[guild.id];
                credentials.hoster = null;
            } else {
                if (this.fcmListenersLite[guild.id]?.[steamId]) {
                    this.fcmListenersLite[guild.id][steamId].destroy();
                }

                if (this.fcmListenersLite[guild.id]) {
                    delete this.fcmListenersLite[guild.id][steamId];
                }
            }

            delete credentials[steamId];
        }

        await getPersistenceService().setCredentials(guild.id, credentials);
    }

    createRustplusInstance(
        guildId: string,
        serverIp: string,
        appPort: number,
        steamId: string,
        playerToken: string,
    ): RustPlus {
        return this.rustPlusManager.createRustplusInstance(guildId, serverIp, appPort, steamId, playerToken);
    }

    async createRustplusInstancesFromConfig(): Promise<void> {
        return this.rustPlusManager.createRustplusInstancesFromConfig();
    }

    async deleteGuildState(guildId: string): Promise<void> {
        this.fcmListeners[guildId]?.destroy();
        delete this.fcmListeners[guildId];

        for (const listener of Object.values(this.fcmListenersLite[guildId] ?? {})) {
            listener.destroy();
        }
        delete this.fcmListenersLite[guildId];

        this.rustPlusManager.deleteGuildInstances(guildId);
        this.localizationService.unloadGuildIntl(guildId);

        if (this.voiceLeaveTimeouts[guildId]) {
            clearTimeout(this.voiceLeaveTimeouts[guildId]);
        }
        delete this.voiceLeaveTimeouts[guildId];

        await getPersistenceService().deleteGuild(guildId);
    }

    resetRustplusVariables(guildId: string): void {
        this.rustPlusManager.resetRustplusVariables(guildId);
    }

    isJpgImageChanged(guildId: string, map: any): boolean {
        return this.rustPlusManager.isJpgImageChanged(guildId, map);
    }

    async findAvailableTrackerId(guildId: string): Promise<number> {
        const instance = await getPersistenceService().readGuildState(guildId);

        while (true) {
            const randomNumber = Math.floor(Math.random() * 1000);
            if (!Object.hasOwn(instance.trackers, randomNumber)) {
                return randomNumber;
            }
        }
    }

    async findAvailableGroupId(guildId: string, serverId: string): Promise<number> {
        const instance = await getPersistenceService().readGuildState(guildId);

        while (true) {
            const randomNumber = Math.floor(Math.random() * 1000);
            if (!Object.hasOwn(instance.serverList[serverId].switchGroups, randomNumber)) {
                return randomNumber;
            }
        }
    }

    async updateBattlemetricsInstances(): Promise<void> {
        const guildIds = [...this.guilds.cache.keys()];
        await this.battlemetricsManager.updateInstances(guildIds);
    }

    async interactionReply(interaction: any, content: any): Promise<any> {
        try {
            return await interaction.reply(content);
        } catch (e: any) {
            this.log(
                this.intlGet(null, 'errorCap'),
                this.intlGet(null, 'interactionReplyFailed', { error: e }),
                'error',
            );
        }

        return undefined;
    }

    async interactionEditReply(interaction: any, content: any): Promise<any> {
        try {
            return await interaction.editReply(content);
        } catch (e: any) {
            this.log(
                this.intlGet(null, 'errorCap'),
                this.intlGet(null, 'interactionEditReplyFailed', { error: e }),
                'error',
            );
        }

        return undefined;
    }

    async interactionUpdate(interaction: any, content: any): Promise<any> {
        try {
            return await interaction.update(content);
        } catch (e: any) {
            this.log(
                this.intlGet(null, 'errorCap'),
                this.intlGet(null, 'interactionUpdateFailed', { error: e }),
                'error',
            );
        }

        return undefined;
    }

    async messageEdit(message: any, content: any): Promise<any> {
        try {
            return await message.edit(content);
        } catch (e: any) {
            this.log(this.intlGet(null, 'errorCap'), this.intlGet(null, 'messageEditFailed', { error: e }), 'error');
        }

        return undefined;
    }

    async messageSend(channel: any, content: any): Promise<any> {
        try {
            return await channel.send(content);
        } catch (e: any) {
            this.log(this.intlGet(null, 'errorCap'), this.intlGet(null, 'messageSendFailed', { error: e }), 'error');
        }

        return undefined;
    }

    async messageReply(message: any, content: any): Promise<any> {
        try {
            return await message.reply(content);
        } catch (e: any) {
            this.log(this.intlGet(null, 'errorCap'), this.intlGet(null, 'messageReplyFailed', { error: e }), 'error');
        }

        return undefined;
    }

    generateVerifyId(): string {
        return Math.floor(Math.random() * 1000000)
            .toString()
            .padStart(6, '0');
    }

    async resolveItemId(
        interaction: any,
        guildId: string,
        itemName: string | null,
        itemId: string | null,
    ): Promise<string | null> {
        const DiscordEmbeds = await import('../discordTools/discordEmbeds.js');
        if (itemName !== null) {
            const item = this.items.getClosestItemIdByName(itemName);
            if (item === null) {
                const str = this.intlGet(guildId, 'noItemWithNameFound', { name: itemName });
                await this.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                this.log(this.intlGet(guildId, 'warningCap'), str);
                return null;
            }
            return item;
        } else if (itemId !== null) {
            if (this.items.itemExist(itemId)) {
                return itemId;
            }
            const str = this.intlGet(guildId, 'noItemWithIdFound', { id: itemId });
            await this.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            this.log(this.intlGet(guildId, 'warningCap'), str);
            return null;
        } else {
            const str = this.intlGet(guildId, 'noNameIdGiven');
            await this.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            this.log(this.intlGet(guildId, 'warningCap'), str);
            return null;
        }
    }

    async validatePermissions(interaction: any): Promise<boolean> {
        const instance = await getPersistenceService().readGuildState(interaction.guildId);

        // If user is blacklisted, admin or not, deny the interaction
        if (instance.blacklist['discordIds'].includes(interaction.user.id)) {
            return false;
        }

        // If role isn't setup yet, validate as true
        if (instance.role === null) {
            return true;
        }

        // If either admin or regular, allow the interaction
        if (!(await this.isAdministrator(interaction)) && !interaction.member.roles.cache.has(instance.role)) {
            const role = DiscordTools.getRole(interaction.guildId, instance.role);
            const str = this.intlGet(interaction.guildId, 'notPartOfRole', { role: role?.name });
            await this.interactionReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            this.log(this.intlGet(null, 'warningCap'), str, 'warn');
            return false;
        }

        return true;
    }

    async isAdministrator(interaction: any): Promise<boolean> {
        const instance = await getPersistenceService().readGuildState(interaction.guildId);

        if (interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
            return true;
        }

        if (instance.adminRole !== null && interaction.member.roles.cache.has(instance.adminRole)) {
            return true;
        }

        if (config.discord.ownerUserId !== null && interaction.user.id === config.discord.ownerUserId) {
            return true;
        }

        return false;
    }
}
