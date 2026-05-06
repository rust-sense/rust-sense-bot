import * as DiscordMessages from '../discordTools/discordMessages.js';
import type { ILocalizationService } from '../interfaces/ILocalizationService.js';

export default async function (rustplus: any, client: ILocalizationService, message: any) {
    await DiscordMessages.sendTeamChatMessage(rustplus.guildId, message);
}
