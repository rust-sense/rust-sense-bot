import * as Discord from 'discord.js';
import config from './config.js';
import { registerSingleton } from './container.js';
import { closePersistence, initPersistence } from './persistence/index.js';
import { BattlemetricsManager } from './services/BattlemetricsManager.js';
import { DiscordNotifier } from './services/DiscordNotifier.js';
import { GameDataProvider } from './services/GameDataProvider.js';
import { LocalizationService } from './services/LocalizationService.js';
import DiscordBot from './structures/DiscordBot.js';
import { RustPlusManager } from './structures/RustPlusManager.js';
import { ensureAppStateDirs } from './utils/filesystemUtils.js';

const localizationService = new LocalizationService();
const gameDataProvider = new GameDataProvider();
const battlemetricsManager = new BattlemetricsManager();

export const client = new DiscordBot(
    {
        intents: [
            Discord.GatewayIntentBits.Guilds,
            Discord.GatewayIntentBits.GuildMessages,
            Discord.GatewayIntentBits.MessageContent,
            Discord.GatewayIntentBits.GuildMembers,
            Discord.GatewayIntentBits.GuildVoiceStates,
        ],
        retryLimit: 2,
        restRequestTimeout: 60000,
    } as Discord.ClientOptions,
    { localizationService, gameDataProvider, battlemetricsManager },
);

const discordNotifier = new DiscordNotifier(localizationService, client.log.bind(client), client);

const rustPlusManager = new RustPlusManager(
    localizationService,
    gameDataProvider,
    battlemetricsManager,
    discordNotifier,
    config.general.pollingIntervalMs,
);

client.rustPlusManager = rustPlusManager;

registerSingleton('discordBot', client);
registerSingleton('localizationService', localizationService);
registerSingleton('gameDataProvider', gameDataProvider);
registerSingleton('battlemetricsManager', battlemetricsManager);
registerSingleton('discordNotifier', discordNotifier);
registerSingleton('rustPlusManager', rustPlusManager);

ensureAppStateDirs().then(async () => {
    await initPersistence();
    client.build();
});

process.on('unhandledRejection', (error) => {
    const errorText = error instanceof Error ? (error.stack ?? error.message) : String(error);
    client.log(
        client.intlGet(null, 'errorCap'),
        client.intlGet(null, 'unhandledRejection', {
            error: errorText,
        }),
        'error',
    );
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
    client.log(client.intlGet(null, 'infoCap'), `Received ${signal}, closing persistence`, 'info');
    try {
        await closePersistence();
    } finally {
        process.exit(0);
    }
}

process.once('SIGINT', (signal) => {
    void shutdown(signal);
});

process.once('SIGTERM', (signal) => {
    void shutdown(signal);
});
