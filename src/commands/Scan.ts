import Command from "../structures/Command";

import {
    CommandInteraction,
    PermissionResolvable,
    TextChannel,
    ThreadChannel,
    Message,
} from "discord.js";
import ClientInterface from "../interfaces/ClientInterface";

export default class ScanCommand extends Command {
    public skipBan: boolean = true;
    public permissions: PermissionResolvable = "MANAGE_GUILD";

    constructor(client: ClientInterface) {
        super(
            client,
            "scan",
            "Scans all messages in the guild and adds them to the database"
        );
    }

    async run(interaction: CommandInteraction) {
        await interaction.reply("Fetching messages...");

        const database = await this.client.database.fetch(interaction.guildId);
        const guild = await this.client.guilds.fetch(interaction.guildId!);
        const me = guild.members.me!;
        const channels = await guild.channels.fetch();

        const allMessages: Message[] = [];

        for (const [, channel] of channels) {
            if (
                !("type" in channel) ||
                !channel.viewable ||
                !channel.permissionsFor(me)?.has("READ_MESSAGE_HISTORY")
            ) {
                continue;
            }

            try {
                if (channel.type === "GUILD_TEXT") {
                    await fetchMessagesFromChannel(channel as TextChannel);
                }

                // check if this is a thread
                else if (channel instanceof ThreadChannel) {
                    await fetchMessagesFromChannel(channel);
                }

                // check for forum channels if .threads exists
                else if (
                    typeof (channel as any).threads?.fetchActive === "function"
                ) {
                    const forum = channel as any;
                    const threads = await forum.threads.fetchActive();
                    const archived = await forum.threads.fetchArchived();

                    for (const [, thread] of threads.threads.concat(archived.threads)) {
                        if (thread.viewable && thread.permissionsFor(me)?.has("READ_MESSAGE_HISTORY")) {
                            await fetchMessagesFromChannel(thread);
                        }
                    }
                }
            } catch (err) {
                console.warn(`Failed to fetch from ${channel.name}:`, err);
            }
        }
        
        async function fetchMessagesFromChannel(channel: TextChannel | ThreadChannel) {
            let lastId: string | undefined = undefined;
            while (true) {
                const options: { limit: number; before?: string } = { limit: 100 };
                if (lastId) options.before = lastId;

                await interaction.editReply(`Fetching messages from ${channel.name}...`);
                
                const messages = await channel.messages.fetch(options);
                if (messages.size === 0) break;

                allMessages.push(...messages.values());
                lastId = messages.last()?.id;

                if (messages.size < 100) break;
            }
        }

        await interaction.editReply(`Adding messages to the database...`);

        let collectPercentage = await database.getCollectionPercentage();
        let messageCount = 0;
        
        for (const message of allMessages) {
            if (Math.random() <= collectPercentage) {
                if (!message.author.bot && message.content && message.content.trim().length > 1) {
                    messageCount++;
                    this.client.database.isTrackAllowed(message.author.id)
                    .then(async () => await database.addText(message.content, message.author.id, message.id))
                    .catch(() => {});
                }
            }
        }

        return interaction.editReply(`Fetched ${allMessages.length} total messages, and added ${messageCount} of them to the database.\nCongrats! You have successfully created a monster!`);
    }
}
