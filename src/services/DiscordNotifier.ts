import type { IDiscordNotifier } from '../interfaces/IDiscordNotifier.js';
import type { ILocalizationService } from '../interfaces/ILocalizationService.js';

export class DiscordNotifier implements IDiscordNotifier {
    constructor(
        private readonly _localization: ILocalizationService,
        private readonly _log: (title: string, text: string, level: string) => void,
        private readonly _botStatus: { uptimeBot: Date | null },
    ) {}

    get uptimeBot(): Date | null {
        return this._botStatus.uptimeBot;
    }

    async messageSend(channel: any, content: any): Promise<any> {
        try {
            return await channel.send(content);
        } catch (e: any) {
            this._log(
                this._localization.intlGet(null, 'errorCap'),
                this._localization.intlGet(null, 'messageSendFailed', { error: e }),
                'error',
            );
        }
        return undefined;
    }
}
