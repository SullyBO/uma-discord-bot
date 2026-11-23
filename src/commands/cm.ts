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
import cms from '../assets/cm.json';
import { CM } from '../types';
import { CONDITION, GROUND, SEASON, TRACK, TURN, WEATHER, lookup } from '../utils/race/properties';

const CM_DATA = cms as CM[];
const activeCollectors = new Map<string, InteractionCollector<ButtonInteraction>>();

export function buildEmbed(cm: CM): EmbedBuilder {
  const name = cm.name_en ?? cm.name;
  const surface = lookup(GROUND, cm.race.ground);
  return new EmbedBuilder()
    .setTitle(`CM ${cm.id} - ${name} - ${surface}`)
    .addFields(
      { name: 'Track', value: lookup(TRACK, cm.race.track), inline: true },
      { name: 'Distance', value: `${cm.race.distance}m`, inline: true },
      { name: 'Direction', value: lookup(TURN, cm.race.turn), inline: true },
      { name: 'Season', value: lookup(SEASON, cm.race.season), inline: true },
      { name: 'Condition', value: lookup(CONDITION, cm.race.condition), inline: true },
      { name: 'Weather', value: lookup(WEATHER, cm.race.weather), inline: true },
    );
}

export function buildRow(pageIndex: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('cm_prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('cm_next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === totalPages - 1),
  );
}

export const data = new SlashCommandBuilder()
  .setName('cm')
  .setDescription('Browse Champions Meetings')
  .addIntegerOption((option) =>
    option.setName('number').setDescription('Start at a specific CM number').setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const number = interaction.options.getInteger('number');
  const totalPages = CM_DATA.length;
  const userId = interaction.user.id;

  let pageIndex = 0;

  if (number !== null) {
    const found = CM_DATA.findIndex((c) => c.id === number);
    if (found === -1) {
      await interaction.reply({
        content: `No Champions Meeting found for #${number}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    pageIndex = found;
  }

  activeCollectors.get(userId)?.stop();

  await interaction.reply({
    embeds: [buildEmbed(CM_DATA[pageIndex])],
    components: [buildRow(pageIndex, totalPages)],
  });

  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) => (i.customId === 'cm_prev' || i.customId === 'cm_next') && i.user.id === userId,
    time: 120_000,
  });

  if (collector) {
    activeCollectors.set(userId, collector);

    collector.on('collect', async (i) => {
      if (i.customId === 'cm_prev') pageIndex = Math.max(0, pageIndex - 1);
      if (i.customId === 'cm_next') pageIndex = Math.min(totalPages - 1, pageIndex + 1);

      await i.update({
        embeds: [buildEmbed(CM_DATA[pageIndex])],
        components: [buildRow(pageIndex, totalPages)],
      });
    });

    collector.on('end', () => {
      activeCollectors.delete(userId);
      interaction.editReply({ components: [] }).catch(() => undefined);
    });
  }
}
