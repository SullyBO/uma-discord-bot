import {
  ActionRowBuilder,
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

export function buildEmbed(detail: UmaDetail): EmbedBuilder {
  const skillsByAcquisition = detail.skills.reduce<Record<string, string[]>>((acc, skill) => {
    if (!acc[skill.acquisition]) acc[skill.acquisition] = [];
    acc[skill.acquisition].push(skill.name);
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
    .addFields(
      {
        name: 'Growth',
        value: `Speed: ${detail.growth_speed}% | Stamina: ${detail.growth_stamina}% | Power: ${detail.growth_power}% | Guts: ${detail.growth_guts}% | Wit: ${detail.growth_wit}%`,
        inline: false,
      },
      {
        name: 'Surface',
        value: `Turf: ${detail.apt_turf} | Dirt: ${detail.apt_dirt}`,
        inline: true,
      },
      {
        name: 'Distance',
        value: `Sprint: ${detail.apt_short} | Mile: ${detail.apt_mile} | Medium: ${detail.apt_medium} | Long: ${detail.apt_long}`,
        inline: true,
      },
      {
        name: 'Running Style',
        value: `Front: ${detail.apt_front} | Pace: ${detail.apt_pace} | Late: ${detail.apt_late} | End: ${detail.apt_end}`,
        inline: true,
      },
      ...skillFields,
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
    await interaction.editReply({ embeds: [buildEmbed(detail)] });
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
    await interaction.editReply({ content: '', components: [], embeds: [buildEmbed(detail)] });
  });

  collector?.on('end', async (collected) => {
    if (collected.size === 0) {
      await interaction.editReply({ content: 'Timed out.', components: [] });
    }
  });
}
