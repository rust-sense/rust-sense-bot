import { getPersistenceService } from '../persistence/index.js';

export default async function ensureGuildCredentials(_client: unknown, guild: { id: string }): Promise<void> {
    const credentials = await getPersistenceService().getCredentials(guild.id);
    await getPersistenceService().setCredentials(guild.id, credentials);
}
