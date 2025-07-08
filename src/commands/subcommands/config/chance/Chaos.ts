import SubCommand from "../../../../structures/SubCommand";

import { CommandInteraction } from "discord.js/typings";
import ClientInterface from "../../../../interfaces/ClientInterface";

export default class ChaosSubCommand extends SubCommand {
    constructor(client: ClientInterface) {
        super(
            client,
            "chaos",
            "Changes how chaotic Joshua is",
            [
                {
                    type: "INTEGER",
                    name: "chaos",
                    description: "the amount hes chaois control #dominions",
                    required: true,
                    minValue: 0,
                    maxValue: 100
                }
            ]
        );
    }

    async run(interaction: CommandInteraction) {
        const lng = { lng: interaction.locale };

        let chance = interaction.options.getInteger(this.options[0].name);
        if (!chance || chance > 100 || chance < 0) return;

        const database = await this.client.database.fetch(interaction.guildId);

        try {
            await database.setChaosPercentage(chance === 0 ? 0 : chance / 100);

            return interaction.reply("im too lazy to write a reply for tihs but it works trust me");
        } catch(e) {
            return interaction.reply({ content: this.t("vars.error", lng), ephemeral: true });
        }
    }
}