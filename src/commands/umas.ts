import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  InteractionCollector,
  SlashCommandBuilder,
  ButtonInteraction,
} from 'discord.js';
import { fetchUmas, Fetcher } from '../api/client';
import { UmaSummary } from '../types';
import { formatUmaVersion } from '../utils';

const activeCollectors = new Map<string, InteractionCollector<ButtonInteraction>>();

export const data = new SlashCommandBuilder()
  .setName('umas')
  .setDescription('List umamusume matching aptitude filters')
  .addStringOption((option) =>
    option
      .setName('filters')
      .setDescription('Aptitude filters e.g. turf:A long:A mile:B')
      .setRequired(false),
  )
  .addBooleanOption((option) =>
    option
      .setName('released')
      .setDescription('Show only released (default: true)')
      .setRequired(false),
  );

const FILTER_KEY_MAP: Record<string, string> = {
  turf: 'turf',
  dirt: 'dirt',
  sprint: 'short',
  mile: 'mile',
  medium: 'medium',
  long: 'long',
  front: 'front',
  pace: 'pace',
  late: 'late',
  end: 'end',
};

export function parseFilters(input: string): Record<string, string> {
  const params: Record<string, string> = {};
  const tokens = input.trim().split(/\s+/);

  for (const token of tokens) {
    const [key, value] = token.split(':');
    if (!key || !value) continue;
    const mapped = FILTER_KEY_MAP[key.toLowerCase()];
    if (mapped) params[mapped] = value.toUpperCase();
  }

  return params;
}

export function formatSummary(uma: UmaSummary): string {
  const slug = uma.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const url = `https://gametora.com/umamusume/characters/${uma.id}-${slug}`;

  return [
    `**[${uma.name}](${url})** - ${formatUmaVersion(uma.subtitle)}`,
    formatReleaseDate(uma),
    `Turf: ${uma.apt_turf} | Dirt: ${uma.apt_dirt}`,
    `Sprint: ${uma.apt_short} | Mile: ${uma.apt_mile} | Medium: ${uma.apt_medium} | Long: ${uma.apt_long}`,
    `Front: ${uma.apt_front} | Pace: ${uma.apt_pace} | Late: ${uma.apt_late} | End: ${uma.apt_end}`,
  ].join('\n');
}

export function formatReleaseDate(uma: UmaSummary): string {
  if (uma.is_predicted_date) {
    const [year, month] = uma.release_date.split('-');
    const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('en', {
      month: 'long',
    });
    return `Expected release: ${monthName} ${year}`;
  }
  return `Release date: ${uma.release_date.replace(/-/g, '/')}`;
}

export function buildPages(lines: string[]): string[] {
  const pages: string[] = [];

  for (let i = 0; i < lines.length; i += 3) {
    pages.push(lines.slice(i, i + 3).join('\n\n'));
  }

  return pages;
}

export function buildEmbed(
  page: string,
  pageIndex: number,
  totalPages: number,
  filters: Record<string, string>,
): EmbedBuilder {
  const filterSummary = Object.entries(filters)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');

  const title = filterSummary ? `Umamusume - ${filterSummary}` : 'Umamusume';

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(page)
    .setFooter({ text: `Page ${pageIndex + 1} of ${totalPages}      src: gametora.com` });
}

export function buildRow(pageIndex: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('umas_prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('umas_next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === totalPages - 1),
  );
}

export async function execute(interaction: ChatInputCommandInteraction, fetcher: Fetcher = fetch) {
  const input = interaction.options.getString('filters') ?? '';
  const released = interaction.options.getBoolean('released') ?? true;
  const params = input ? parseFilters(input) : {};
  const userId = interaction.user.id;

  await interaction.deferReply();

  const umas = await fetchUmas({ ...params, released }, fetcher);

  if (umas.length === 0) {
    await interaction.editReply({ content: 'No umamusume found matching those filters.' });
    return;
  }

  const lines = umas.map(formatSummary);
  const pages = buildPages(lines);

  if (pages.length === 1) {
    await interaction.editReply({ embeds: [buildEmbed(pages[0], 0, 1, params)] });
    return;
  }

  let pageIndex = 0;

  activeCollectors.get(userId)?.stop();

  await interaction.editReply({
    embeds: [buildEmbed(pages[pageIndex], pageIndex, pages.length, params)],
    components: [buildRow(pageIndex, pages.length)],
  });

  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) =>
      (i.customId === 'umas_prev' || i.customId === 'umas_next') && i.user.id === userId,
    time: 120_000,
  });

  if (collector) {
    activeCollectors.set(userId, collector);

    collector.on('collect', async (i) => {
      if (i.customId === 'umas_prev') pageIndex = Math.max(0, pageIndex - 1);
      if (i.customId === 'umas_next') pageIndex = Math.min(pages.length - 1, pageIndex + 1);

      await i.update({
        embeds: [buildEmbed(pages[pageIndex], pageIndex, pages.length, params)],
        components: [buildRow(pageIndex, pages.length)],
      });
    });

    collector.on('end', () => {
      activeCollectors.delete(userId);
      interaction.editReply({ components: [] }).catch(() => undefined);
    });
  }
}
