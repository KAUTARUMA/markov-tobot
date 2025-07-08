import Command from "../structures/Command";

import {
    CommandInteraction,
    PermissionResolvable,
    TextChannel,
    ThreadChannel,
    Message,
} from "discord.js";
import ClientInterface from "../interfaces/ClientInterface";

export default class ScanAsyncCommand extends Command {
    public skipBan: boolean = true;
    public permissions: PermissionResolvable = "MANAGE_GUILD";

    // Counters as class properties
    private totalMessagesScanned: number = 0;
    private totalMessagesAdded: number = 0;

    constructor(client: ClientInterface) {
        super(
            client,
            "scanasync",
            "Scans all messages in the guild and adds them to the database BUT COOL"
        );
    }

    async run(interaction: CommandInteraction) {
        await interaction.reply("Starting message scan...");

        const database = await this.client.database.fetch(interaction.guildId);
        const guild = await this.client.guilds.fetch(interaction.guildId!);
        const me = guild.members.me!;
        const channels = await guild.channels.fetch();

        const collectPercentage = await database.getCollectionPercentage();

        // Reset counters
        this.totalMessagesScanned = 0;
        this.totalMessagesAdded = 0;

        const bannedChannels = [
            "1361370424943841540", 
            "1361371171236352171", 
            "1361435863963406467",
            "810581626307739739",
            "761708931193372752",
            "717313998181105704",
            "868998231512719431"
        ]

        const onlyChannels = [
            "1325244548368040069",
            "1336455219734773760"
        ]

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
                    if (bannedChannels.includes(channel.id)) {
                        continue;
                    }

                    //if (onlyChannels.includes(channel.id)) {
                        await this.processChannel(interaction, channel as TextChannel, collectPercentage, database);
                    //}
                }
            } catch (err) {
                console.warn(`Failed to fetch from ${channel.name}:`, err);
            }
        }

        return interaction.editReply(`Scan complete! Scanned ${this.totalMessagesScanned} total messages, and added ${this.totalMessagesAdded} of them to the database.\nCongrats! You have successfully created a monster!`);
    }

    private async processChannel(
        interaction: CommandInteraction,
        channel: TextChannel | ThreadChannel,
        collectPercentage: number,
        database: any
    ): Promise<void> {
        let lastId: string | undefined = undefined;
        let batchCount = 0;
        
        while (true) {
            const options: { limit: number; before?: string } = { limit: 100 };
            if (lastId) options.before = lastId;

            await interaction.editReply(`Scanning ${channel.name}... (Batch ${batchCount + 1})`);

            if (batchCount > 4) {
                break;
            }

            const messages = await channel.messages.fetch(options);
            if (messages.size === 0) break;

            // Process each message immediately
            for (const message of messages.values()) {
                if (!message.author.bot && message.content && message.content.trim().length > 1) {
                    this.totalMessagesScanned++;
                    //if (Math.random() <= collectPercentage) {
                        try {
                            const isAllowed = await this.client.database.isTrackAllowed(message.author.id);
                            if (isAllowed) {
                                await database.addText(message.content, message.author.id, message.id);
                                this.totalMessagesAdded++;
                            }
                        } catch (err) {
                            console.warn(`Failed to add message ${message.id} to database:`, err);
                        }
                    //}
                }
            }

            lastId = messages.last()?.id;
            batchCount++;

            if (messages.size < 100) break;
        }
    }
}