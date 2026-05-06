export interface ILocalizationService {
    intlGet(guildId: string | null, id: string, variables?: Record<string, unknown>): string;
}
