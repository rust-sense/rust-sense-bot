import { createIntl, createIntlCache } from '@formatjs/intl';
import { IntlMessageFormat } from 'intl-messageformat';
import config from '../config.js';
import * as Constants from '../domain/constants.js';
import type { ILocalizationService } from '../interfaces/ILocalizationService.js';
import { getPersistenceService } from '../persistence/index.js';
import type { Instance } from '../types/instance.js';
import { loadJsonResourceSync } from '../utils/filesystemUtils.js';

export class LocalizationService implements ILocalizationService {
    private readonly _intlInstances: Record<string, ReturnType<typeof createIntl>> = {};
    private readonly _guildLanguages: Record<string, string> = {};
    private readonly _customGuildIntl: Record<string, Record<string, IntlMessageFormat>> = {};
    private readonly _localeCache: ReturnType<typeof createIntlCache>;

    constructor() {
        this._localeCache = createIntlCache();
        this.checkLocaleIntlLoad(Constants.DEFAULT_LOCALE);
        this.checkLocaleIntlLoad(config.general.language);
    }

    private _createIntlForLocale(locale: string): ReturnType<typeof createIntl> {
        const messages = loadJsonResourceSync<Record<string, string>>(`languages/${locale}.json`);
        return createIntl({ locale, messages, defaultLocale: Constants.DEFAULT_LOCALE }, this._localeCache);
    }

    checkLocaleIntlLoad(locale: string): ReturnType<typeof createIntl> {
        if (locale in this._intlInstances) {
            return this._intlInstances[locale];
        }
        const instance = this._createIntlForLocale(locale);
        this._intlInstances[locale] = instance;
        return instance;
    }

    private _formatWithIntl(
        intlInstance: ReturnType<typeof createIntl>,
        id: string,
        variables: Record<string, unknown> = {},
    ): string {
        const englishIntl = this.checkLocaleIntlLoad(Constants.DEFAULT_LOCALE);
        const messages = englishIntl.messages as Record<string, string>;
        const defaultMessage = messages[id];
        return intlInstance.formatMessage(
            { id, defaultMessage },
            variables as Record<string, string | number | Date | boolean>,
        ) as string;
    }

    intlGet(guildId: string | null, id: string, variables: Record<string, unknown> = {}): string {
        if (guildId === null) {
            return this._formatWithIntl(this.checkLocaleIntlLoad(config.general.language), id, variables);
        }

        if (guildId === Constants.DEFAULT_LOCALE) {
            return this._formatWithIntl(this.checkLocaleIntlLoad(Constants.DEFAULT_LOCALE), id, variables);
        }

        if (guildId in this._customGuildIntl && id in this._customGuildIntl[guildId]) {
            return this._customGuildIntl[guildId][id].format(variables) as string;
        }

        return this._formatWithIntl(
            this.checkLocaleIntlLoad(this._guildLanguages[guildId] ?? config.general.language),
            id,
            variables,
        );
    }

    loadGuildIntl(guildId: string, instance: Instance): void {
        this.checkLocaleIntlLoad(instance.generalSettings.language);
        this._guildLanguages[guildId] = instance.generalSettings.language;

        for (const [key, message] of Object.entries(instance.customIntlMessages)) {
            this.loadGuildCustomIntl(guildId, instance, key, message);
        }
    }

    loadGuildCustomIntl(guildId: string, instance: Instance, key: string, message: string): void {
        if (!(guildId in this._customGuildIntl)) {
            this._customGuildIntl[guildId] = {};
        }
        this._customGuildIntl[guildId][key] = new IntlMessageFormat(message, instance.generalSettings.language);
    }

    unloadGuildIntl(guildId: string): void {
        delete this._customGuildIntl[guildId];
        delete this._guildLanguages[guildId];
    }

    removeCustomIntlKey(guildId: string, key: string): void {
        if (guildId in this._customGuildIntl) {
            delete this._customGuildIntl[guildId][key];
        }
    }

    async loadGuildsIntlFromGuildIds(guildIds: string[]): Promise<void> {
        for (const guildId of guildIds) {
            const instance = await getPersistenceService().readGuildState(guildId);
            this.loadGuildIntl(guildId, instance);
        }
    }
}
