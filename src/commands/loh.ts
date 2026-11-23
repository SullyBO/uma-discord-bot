import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  InteractionCollector,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import lohs from '../assets/loh.json';
import { CONDITION, GROUND, SEASON, TRACK, TURN, WEATHER, lookup } from '../utils/race/properties';
import { LoH } from '../types';

const LOH_DATA = lohs as LoH[];

// LoH data ships weather/condition as 0; races are always run Sunny + Firm.
const LOH_CONDITION = 1;
const LOH_WEATHER = 1;

const activeCollectors = new Map<string, InteractionCollector<ButtonInteraction>>();

export function buildEmbed(loh: LoH): EmbedBuilder {
  const surface = lookup(GROUND, loh.race.ground);
  return new EmbedBuilder()
    .setTitle(`LoH ${loh.id} - ${surface}`)
    .addFields(
      { name: 'Track', value: lookup(TRACK, loh.race.track), inline: true },
      { name: 'Distance', value: `${loh.race.distance}m`, inline: true },
      { name: 'Direction', value: lookup(TURN, loh.race.turn), inline: true },
      { name: 'Season', value: lookup(SEASON, loh.race.season), inline: true },
      { name: 'Condition', value: lookup(CONDITION, LOH_CONDITION), inline: true },
      { name: 'Weather', value: lookup(WEATHER, LOH_WEATHER), inline: true },
    );
}

export function buildRow(pageIndex: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('loh_prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('loh_next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === totalPages - 1),
  );
}

export const data = new SlashCommandBuilder()
  .setName('loh')
  .setDescription('Browse League of Heroes seasons')
  .addIntegerOption((option) =>
    option.setName('number').setDescription('Start at a specific LoH number').setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const number = interaction.options.getInteger('number');
  const totalPages = LOH_DATA.length;
  const userId = interaction.user.id;

  let pageIndex = 0;

  if (number !== null) {
    const found = LOH_DATA.findIndex((l) => l.id === number);
    if (found === -1) {
      await interaction.reply({
        content: `No League of Heroes found for #${number}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    pageIndex = found;
  }

  activeCollectors.get(userId)?.stop();

  await interaction.reply({
    embeds: [buildEmbed(LOH_DATA[pageIndex])],
    components: [buildRow(pageIndex, totalPages)],
  });

  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) => (i.customId === 'loh_prev' || i.customId === 'loh_next') && i.user.id === userId,
    time: 120_000,
  });

  if (collector) {
    activeCollectors.set(userId, collector);

    collector.on('collect', async (i) => {
      if (i.customId === 'loh_prev') pageIndex = Math.max(0, pageIndex - 1);
      if (i.customId === 'loh_next') pageIndex = Math.min(totalPages - 1, pageIndex + 1);

      await i.update({
        embeds: [buildEmbed(LOH_DATA[pageIndex])],
        components: [buildRow(pageIndex, totalPages)],
      });
    });

    collector.on('end', () => {
      activeCollectors.delete(userId);
      interaction.editReply({ components: [] }).catch(() => undefined);
    });
  }
}
