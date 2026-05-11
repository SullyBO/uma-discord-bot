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

const CM_DATA = cms as CM[];

const GROUND: Record<number, string> = { 1: 'Turf', 2: 'Dirt' };
const SEASON: Record<number, string> = {
  1: 'Spring',
  2: 'Summer',
  3: 'Fall',
  4: 'Winter',
  5: 'Cherry Blossom',
};
const WEATHER: Record<number, string> = { 1: 'Sunny', 2: 'Cloudy', 3: 'Rainy', 4: 'Snowy' };
const CONDITION: Record<number, string> = { 1: 'Firm', 2: 'Good', 3: 'Soft', 4: 'Heavy' };
const TURN: Record<number, string> = { 1: 'Right-handed', 2: 'Left-handed' };
const TRACK: Record<number, string> = {
  10001: 'Sapporo',
  10002: 'Hakodate',
  10003: 'Niigata',
  10004: 'Fukushima',
  10005: 'Nakayama',
  10006: 'Tokyo',
  10007: 'Chukyo',
  10008: 'Kyoto',
  10009: 'Hanshin',
  10010: 'Kokura',
  10101: 'Ooi',
  10103: 'Kawasaki',
  10104: 'Funabashi',
  10105: 'Morioka',
  10201: 'Longchamp',
  10202: 'Santa Anita Park',
  10203: 'Del Mar',
};

const activeCollectors = new Map<string, InteractionCollector<ButtonInteraction>>();

export function buildEmbed(cm: CM): EmbedBuilder {
  const name = cm.name_en ?? cm.name;
  const surface = GROUND[cm.race.ground] ?? String(cm.race.ground);
  return new EmbedBuilder().setTitle(`CM ${cm.id} - ${name} - ${surface}`).addFields(
    { name: 'Track', value: TRACK[cm.race.track] ?? String(cm.race.track), inline: true },
    { name: 'Distance', value: `${cm.race.distance}m`, inline: true },
    { name: 'Direction', value: TURN[cm.race.turn] ?? String(cm.race.turn), inline: true },
    { name: 'Season', value: SEASON[cm.race.season] ?? String(cm.race.season), inline: true },
    {
      name: 'Condition',
      value: CONDITION[cm.race.condition] ?? String(cm.race.condition),
      inline: true,
    },
    { name: 'Weather', value: WEATHER[cm.race.weather] ?? String(cm.race.weather), inline: true },
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
