import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Collection,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { umaCache } from '../cache';
import { fetchUmaById, Fetcher } from '../api/client';
import { UmaDetail, UmaIndex } from '../types';
import { formatUmaVersion } from '../utils';

export const data = new SlashCommandBuilder()
  .setName('uma')
  .setDescription('Look up an umamusume')
  .addStringOption((option) =>
    option.setName('name').setDescription('The umamusume to look up').setRequired(true),
  );

const ACQUISITION_ORDER = ['Unique', 'Innate', 'Awakening', 'Event'];
// Simply add `Evolution` at the end of the array to enable evo skills once they're in global

export function buildDetailsEmbed(detail: UmaDetail): EmbedBuilder {
  const slug = detail.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const url = `https://gametora.com/umamusume/characters/${detail.id}-${slug}`;

  return new EmbedBuilder()
    .setTitle(detail.name)
    .setURL(url)
    .setDescription(formatUmaVersion(detail.subtitle))
    .setFooter({ text: 'source: gametora' })
    .addFields(
      {
        name: 'Growth',
        value: `Speed: ${detail.growth_speed}% | Stamina: ${detail.growth_stamina}% | Power: ${detail.growth_power}% | Guts: ${detail.growth_guts}% | Wit: ${detail.growth_wit}%`,
        inline: false,
      },
      {
        name: 'Surface',
        value: `Turf: ${detail.apt_turf}\nDirt: ${detail.apt_dirt}`,
        inline: true,
      },
      {
        name: 'Distance',
        value: `Sprint: ${detail.apt_short} | Mile: ${detail.apt_mile}\nMedium: ${detail.apt_medium} | Long: ${detail.apt_long}`,
        inline: true,
      },
      {
        name: 'Running Style',
        value: `Front: ${detail.apt_front} | Pace: ${detail.apt_pace}\nLate: ${detail.apt_late} | End: ${detail.apt_end}`,
        inline: true,
      },
    );
}

export function buildSkillsEmbed(detail: UmaDetail): EmbedBuilder {
  const skillsByAcquisition = detail.skills.reduce<Record<string, string[]>>((acc, skill) => {
    const key = skill.acquisition.charAt(0).toUpperCase() + skill.acquisition.slice(1);
    if (!acc[key]) acc[key] = [];
    acc[key].push(skill.name);
    return acc;
  }, {});

  const skillFields = ACQUISITION_ORDER.filter(
    (acquisition) => skillsByAcquisition[acquisition],
  ).map((acquisition) => ({
    name: acquisition,
    value: `\`\`\`${skillsByAcquisition[acquisition].join(' · ')}\`\`\``,
    inline: false,
  }));

  const slug = detail.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const url = `https://gametora.com/umamusume/characters/${detail.id}-${slug}`;

  return new EmbedBuilder()
    .setTitle(detail.name)
    .setURL(url)
    .setDescription(formatUmaVersion(detail.subtitle))
    .setFooter({ text: 'source: gametora' })
    .addFields(...skillFields);
}

export function buildPageRow(currentPage: 'details' | 'skills'): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('uma_toggle')
      .setLabel(currentPage === 'details' ? 'View Skills' : 'View Details')
      .setStyle(ButtonStyle.Secondary),
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  cache: Collection<number, UmaIndex> = umaCache,
  fetcher: Fetcher = fetch,
) {
  const query = interaction.options.getString('name', true).toLowerCase();

  const matches = cache.filter((uma) => uma.name.toLowerCase().includes(query));

  if (matches.size === 0) {
    await interaction.reply({
      content: `No umamusume found for "${query}".`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (matches.size === 1) {
    await interaction.deferReply();
    const detail = await fetchUmaById(matches.first()!.id, fetcher);

    let currentPage: 'details' | 'skills' = 'details';

    await interaction.editReply({
      embeds: [buildDetailsEmbed(detail)],
      components: [buildPageRow(currentPage)],
    });

    const collector = interaction.channel?.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.customId === 'uma_toggle' && i.user.id === interaction.user.id,
      time: 120_000,
    });

    collector?.on('collect', async (i) => {
      currentPage = currentPage === 'details' ? 'skills' : 'details';
      const embed =
        currentPage === 'details' ? buildDetailsEmbed(detail) : buildSkillsEmbed(detail);
      await i.update({ embeds: [embed], components: [buildPageRow(currentPage)] });
    });

    collector?.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => undefined);
    });

    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('uma_select')
    .setPlaceholder('Select an umamusume')
    .addOptions(
      matches.map((uma) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(uma.name)
          .setDescription(formatUmaVersion(uma.version))
          .setValue(String(uma.id)),
      ),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await interaction.reply({
    content: `Multiple umamusume found for "${query}":`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });

  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: (i) => i.customId === 'uma_select' && i.user.id === interaction.user.id,
    time: 30_000,
    max: 1,
  });

  collector?.on('collect', async (i) => {
    await i.deferUpdate();
    const detail = await fetchUmaById(Number(i.values[0]), fetcher);
    let currentPage: 'details' | 'skills' = 'details';

    await interaction.editReply({
      content: '',
      components: [buildPageRow(currentPage)],
      embeds: [buildDetailsEmbed(detail)],
    });

    const toggleCollector = interaction.channel?.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (j) => j.customId === 'uma_toggle' && j.user.id === interaction.user.id,
      time: 120_000,
    });

    toggleCollector?.on('collect', async (j) => {
      currentPage = currentPage === 'details' ? 'skills' : 'details';
      const embed =
        currentPage === 'details' ? buildDetailsEmbed(detail) : buildSkillsEmbed(detail);
      await j.update({ embeds: [embed], components: [buildPageRow(currentPage)] });
    });

    toggleCollector?.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => undefined);
    });
  });

  collector?.on('end', async (collected) => {
    if (collected.size === 0) {
      await interaction.editReply({ content: 'Timed out.', components: [] });
    }
  });
}
