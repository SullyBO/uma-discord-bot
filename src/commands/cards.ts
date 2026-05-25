import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Collection,
  ComponentType,
  EmbedBuilder,
  InteractionCollector,
  SlashCommandBuilder,
  ButtonInteraction,
} from 'discord.js';
import { cardCache } from '../cache';
import { CardIndex } from '../types';
import { formatCardType, formatRarity } from '../utils';

const activeCollectors = new Map<string, InteractionCollector<ButtonInteraction>>();

export const data = new SlashCommandBuilder()
  .setName('cards')
  .setDescription('List support cards')
  .addStringOption((option) =>
    option
      .setName('type')
      .setDescription('Filter by card type (e.g. Speed, Stamina)')
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName('rarity')
      .setDescription('Filter by rarity (e.g. SSR, SR, R)')
      .setRequired(false),
  )
  .addBooleanOption((option) =>
    option.setName('welfare').setDescription('Show only welfare cards').setRequired(false),
  )
  .addBooleanOption((option) =>
    option
      .setName('released')
      .setDescription('Show only released cards (default: true)')
      .setRequired(false),
  );

function formatReleaseDate(card: CardIndex): string {
  if (!card.release_date) return '';
  const date = new Date(card.release_date);
  const today = new Date();
  if (card.is_predicted_date) {
    const [year, month] = card.release_date.split('-');
    const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('en', {
      month: 'long',
    });
    return ` - Expected: ${monthName} ${year}`;
  }
  if (date > today) {
    return ` - Release date: ${card.release_date.replace(/-/g, '/')}`;
  }
  return ` - Released: ${card.release_date.replace(/-/g, '/')}`;
}

export function formatCardLine(card: CardIndex): string {
  const title = card.title || '';
  const type = formatCardType(card.card_type);
  const rarity = formatRarity(card.rarity);
  const welfare = card.is_welfare ? ' - Welfare' : '';
  const release = formatReleaseDate(card);
  return `**${card.char_name}** ${title}\n${type} - ${rarity}${welfare}${release}`;
}

export function buildPages(lines: string[]): string[] {
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += 5) {
    pages.push(lines.slice(i, i + 5).join('\n\n'));
  }
  return pages;
}

export function buildEmbed(
  page: string,
  pageIndex: number,
  totalPages: number,
  filters: { type?: string; rarity?: string; welfare?: boolean; released?: boolean },
): EmbedBuilder {
  const parts: string[] = [];
  if (filters.type) parts.push(`Type: ${formatCardType(filters.type)}`);
  if (filters.rarity) parts.push(`Rarity: ${formatRarity(filters.rarity)}`);
  else parts.push('SSR/SR only');
  if (filters.welfare) parts.push('Welfare only');
  if (filters.released === false) parts.push('Including unreleased');

  const title = parts.length > 0 ? `Support Cards - ${parts.join(' | ')}` : 'Support Cards';

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(page)
    .setFooter({ text: `Page ${pageIndex + 1} of ${totalPages}` });
}

export function buildRow(pageIndex: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('cards_prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('cards_next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === totalPages - 1),
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  cache: Collection<number, CardIndex> = cardCache,
): Promise<void> {
  const typeFilter = interaction.options.getString('type')?.toLowerCase() ?? null;
  const rarityFilter = interaction.options.getString('rarity')?.toLowerCase() ?? null;
  const welfareFilter = interaction.options.getBoolean('welfare') ?? false;
  const releasedFilter = interaction.options.getBoolean('released') ?? true;
  const userId = interaction.user.id;

  const today = new Date();

  const filtered = cache.filter((card) => {
    if (typeFilter && card.card_type.toLowerCase() !== typeFilter) return false;
    if (rarityFilter && card.rarity.toLowerCase() !== rarityFilter) return false;
    if (!rarityFilter && card.rarity.toLowerCase() === 'r') return false;
    if (welfareFilter && !card.is_welfare) return false;
    if (releasedFilter) {
      if (!card.release_date) return false;
      if (new Date(card.release_date) > today) return false;
    }
    return true;
  });

  const cards = [...filtered.values()];

  if (cards.length === 0) {
    await interaction.reply({ content: 'No cards found matching those filters.' });
    return;
  }

  const lines = cards.map(formatCardLine);
  const pages = buildPages(lines);
  const filters = {
    type: typeFilter ?? undefined,
    rarity: rarityFilter ?? undefined,
    welfare: welfareFilter,
    released: releasedFilter,
  };

  await interaction.deferReply();

  if (pages.length === 1) {
    await interaction.editReply({
      embeds: [buildEmbed(pages[0], 0, 1, filters)],
    });
    return;
  }

  let pageIndex = 0;

  activeCollectors.get(userId)?.stop();

  await interaction.editReply({
    embeds: [buildEmbed(pages[pageIndex], pageIndex, pages.length, filters)],
    components: [buildRow(pageIndex, pages.length)],
  });

  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) =>
      (i.customId === 'cards_prev' || i.customId === 'cards_next') && i.user.id === userId,
    time: 120_000,
  });

  if (collector) {
    activeCollectors.set(userId, collector);

    collector.on('collect', async (i) => {
      if (i.customId === 'cards_prev') pageIndex = Math.max(0, pageIndex - 1);
      if (i.customId === 'cards_next') pageIndex = Math.min(pages.length - 1, pageIndex + 1);

      await i.update({
        embeds: [buildEmbed(pages[pageIndex], pageIndex, pages.length, filters)],
        components: [buildRow(pageIndex, pages.length)],
      });
    });

    collector.on('end', () => {
      activeCollectors.delete(userId);
      interaction.editReply({ components: [] }).catch(() => undefined);
    });
  }
}
