export interface IDiscordNotifier {
    messageSend(channel: unknown, content: unknown): Promise<unknown>;
    uptimeBot: Date | null;
}
