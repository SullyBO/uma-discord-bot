import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Collection,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  RepliableInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { cardCache, skillCache, umaCache } from '../cache';
import { fetchCardById, Fetcher } from '../api/client';
import { CardDetail, CardIndex } from '../types';
import { renderSkill } from './skill';
import { formatCardType, formatRarity } from '../utils/formatters';
import { EMOJIS } from '../constants/emojis';

export const data = new SlashCommandBuilder()
  .setName('card')
  .setDescription('Look up a support card')
  .addStringOption((option) =>
    option.setName('name').setDescription('The support card to look up').setRequired(true),
  );

type LbLevel = 'lb0' | 'lb1' | 'lb2' | 'lb3' | 'mlb';
type Page = 'skills' | LbLevel;

const PAGE_ORDER: Page[] = ['skills', 'lb0', 'lb1', 'lb2', 'lb3', 'mlb'];

const LB_LABELS: Record<LbLevel, string> = {
  lb0: '0LB',
  lb1: '1LB',
  lb2: '2LB',
  lb3: '3LB',
  mlb: 'MLB',
};

const ACQUISITION_ORDER = ['Event', 'Hint'];

function cardUrl(detail: CardDetail): string {
  const slug = detail.char_name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://gametora.com/umamusume/supports/${detail.support_id}-${slug}`;
}

function formatCardReleaseDate(detail: CardDetail): string {
  if (!detail.release_date) return '';

  if (detail.is_predicted_date) {
    const [year, month] = detail.release_date.split('-');
    const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('en', {
      month: 'long',
    });
    return `\nExpected release: ${monthName} ${year}`;
  }

  return `\nRelease date: ${detail.release_date.replace(/-/g, '/')}`;
}

function buildBaseEmbed(detail: CardDetail, page: Page): EmbedBuilder {
  const url = cardUrl(detail);
  const welfareTag = detail.is_welfare ? ' - Welfare' : '';
  const cardType = formatCardType(detail.card_type);
  const rarity = formatRarity(detail.rarity);
  const description =
    `${detail.char_name} - ${cardType} - ${rarity}${welfareTag}` + formatCardReleaseDate(detail);

  const pageLabel = page === 'skills' ? 'Skills' : `Effects (${LB_LABELS[page]})`;

  return new EmbedBuilder()
    .setTitle(detail.title || detail.char_name)
    .setURL(url)
    .setDescription(description)
    .setFooter({ text: `${pageLabel}      src: gametora.com` });
}

export function buildSkillsEmbed(
  detail: CardDetail,
  resolvedSkillCache: Collection<number, { id: number; name: string }>,
): EmbedBuilder {
  const skillsByAcquisition = detail.skills.reduce<Record<string, string[]>>((acc, skill) => {
    const key = skill.acquisition.charAt(0).toUpperCase() + skill.acquisition.slice(1);
    const name = resolvedSkillCache.get(skill.skill_id)?.name ?? `Unknown (${skill.skill_id})`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(name);
    return acc;
  }, {});

  const skillFields = ACQUISITION_ORDER.filter(
    (acquisition) => skillsByAcquisition[acquisition],
  ).map((acquisition) => ({
    name: acquisition,
    value: `\`\`\`${skillsByAcquisition[acquisition].join(' - ')}\`\`\``,
    inline: false,
  }));

  const embed = buildBaseEmbed(detail, 'skills');

  return embed.addFields(...skillFields);
}

const WELFARE_UNIQUE_THRESHOLD: LbLevel[] = ['lb2', 'lb3', 'mlb'];

export function buildEffectsEmbed(detail: CardDetail, lb: LbLevel): EmbedBuilder {
  const effectLines = detail.effects.map((e) => `**${e.effect_name}**: ${e[lb] ?? '-'}`).join('\n');

  const embed = buildBaseEmbed(detail, lb);

  const uniqueActive =
    detail.unique_effect && (detail.is_welfare ? WELFARE_UNIQUE_THRESHOLD.includes(lb) : true);

  if (uniqueActive) {
    embed.addFields({ name: 'Unique Effect', value: detail.unique_effect!, inline: false });
  }

  embed.addFields({
    name: `Effects at ${LB_LABELS[lb]}`,
    value: effectLines || 'No effects.',
    inline: false,
  });

  return embed;
}

export function buildPageRow(currentPage: Page): ActionRowBuilder<ButtonBuilder> {
  const currentIndex = PAGE_ORDER.indexOf(currentPage);
  const nextPage = PAGE_ORDER[(currentIndex + 1) % PAGE_ORDER.length];
  const prevPage = PAGE_ORDER[(currentIndex - 1 + PAGE_ORDER.length) % PAGE_ORDER.length];

  const prevLabel = prevPage === 'skills' ? '← Skills' : `← ${LB_LABELS[prevPage as LbLevel]}`;
  const nextLabel = nextPage === 'skills' ? 'Skills →' : `${LB_LABELS[nextPage as LbLevel]} →`;

  const prevButton = new ButtonBuilder()
    .setCustomId('card_prev')
    .setLabel(prevLabel)
    .setStyle(ButtonStyle.Secondary);

  const nextButton = new ButtonBuilder()
    .setCustomId('card_next')
    .setLabel(nextLabel)
    .setStyle(ButtonStyle.Secondary);

  if (currentPage === 'skills') {
    const browseButton = new ButtonBuilder()
      .setCustomId('card_skill_browse')
      .setLabel('View a Skill')
      .setStyle(ButtonStyle.Primary);
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      prevButton,
      nextButton,
      browseButton,
    );
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);
}

function buildEmbed(
  detail: CardDetail,
  page: Page,
  cache: Collection<number, { id: number; name: string }>,
): EmbedBuilder {
  if (page === 'skills') return buildSkillsEmbed(detail, cache);
  return buildEffectsEmbed(detail, page);
}

async function attachPageCollector(
  interaction: ChatInputCommandInteraction,
  detail: CardDetail,
  message: Awaited<ReturnType<typeof interaction.fetchReply>>,
  cache: Collection<number, { id: number; name: string }>,
  fetcher: Fetcher = fetch,
): Promise<void> {
  let currentPage: Page = 'skills';

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) =>
      (i.customId === 'card_prev' ||
        i.customId === 'card_next' ||
        i.customId === 'card_skill_browse') &&
      i.user.id === interaction.user.id,
    time: 120_000,
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'card_skill_browse') {
      const options = detail.skills.slice(0, 25).map((skill) => {
        const name = cache.get(skill.skill_id)?.name ?? `Unknown (${skill.skill_id})`;
        return new StringSelectMenuOptionBuilder().setLabel(name).setValue(String(skill.skill_id));
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId('card_skill_select')
        .setPlaceholder('Select a skill')
        .addOptions(options);

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      const { resource } = await i.reply({
        content: 'Select a skill to look up:',
        components: [selectRow],
        flags: MessageFlags.Ephemeral,
        withResponse: true,
      });

      const selectMessage = resource!.message!;

      try {
        const selected = await selectMessage.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          filter: (s) => s.customId === 'card_skill_select' && s.user.id === interaction.user.id,
          time: 30_000,
        });

        await selected.deferUpdate();
        await i.deleteReply();
        await renderSkill(selected, Number(selected.values[0]), fetcher, umaCache, cardCache);
      } catch {
        try {
          await i.editReply({ content: 'Timed out.', components: [] });
        } catch {}
      }
      return;
    }

    const currentIndex = PAGE_ORDER.indexOf(currentPage);

    if (i.customId === 'card_next') {
      currentPage = PAGE_ORDER[(currentIndex + 1) % PAGE_ORDER.length];
    } else {
      currentPage = PAGE_ORDER[(currentIndex - 1 + PAGE_ORDER.length) % PAGE_ORDER.length];
    }

    await i.update({
      embeds: [buildEmbed(detail, currentPage, cache)],
      components: [buildPageRow(currentPage)],
    });
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => undefined);
  });
}

async function showCard(
  interaction: ChatInputCommandInteraction,
  id: number,
  fetcher: Fetcher,
  cache: Collection<number, { id: number; name: string }>,
): Promise<void> {
  const detail = await fetchCardById(id, fetcher);
  await interaction.editReply({
    embeds: [buildSkillsEmbed(detail, cache)],
    components: [buildPageRow('skills')],
  });
  const message = await interaction.fetchReply();
  await attachPageCollector(interaction, detail, message, cache, fetcher);
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  cache: Collection<number, CardIndex> = cardCache,
  skCache: Collection<number, { id: number; name: string }> = skillCache,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const query = interaction.options.getString('name', true).toLowerCase();

  const matches = cache.filter((card) => card.char_name.toLowerCase().includes(query));

  if (matches.size === 0) {
    await interaction.reply({
      content: `No support card found for "${query}".`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (matches.size === 1) {
    await interaction.deferReply();
    await showCard(interaction, matches.first()!.support_id, fetcher, skCache);
    return;
  }

  const options = matches.first(25).map((card) => {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(`${card.char_name} - ${formatRarity(card.rarity)}`)
      .setDescription(card.title || 'Unreleased')
      .setValue(String(card.support_id));

    const emoji = EMOJIS[card.card_type as keyof typeof EMOJIS];
    if (emoji) {
      const id = emoji.match(/:(\d+)>/)?.[1];
      if (id) option.setEmoji({ id });
    }

    return option;
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId('card_select')
    .setPlaceholder('Select a support card')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const { resource } = await interaction.reply({
    content: `Multiple cards found for "${query}". Please select one:`,
    components: [row],
    flags: MessageFlags.Ephemeral,
    withResponse: true,
  });

  const reply = resource!.message!;

  try {
    const i = await reply.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.customId === 'card_select' && i.user.id === interaction.user.id,
      time: 30_000,
    });

    await i.deferUpdate();
    const detail = await fetchCardById(Number(i.values[0]), fetcher);
    await interaction.deleteReply();
    const followUp = await interaction.followUp({
      embeds: [buildSkillsEmbed(detail, skCache)],
      components: [buildPageRow('skills')],
    });
    await attachPageCollector(interaction, detail, followUp, skCache, fetcher);
  } catch (error) {
    console.error('card command error:', error);
    try {
      await interaction.editReply({ content: 'Timed out.', components: [] });
    } catch {
      await interaction.followUp({ content: 'Timed out.', flags: MessageFlags.Ephemeral });
    }
  }
}

export async function renderCard(
  interaction: RepliableInteraction,
  cardId: number,
  fetcher: Fetcher = fetch,
  skCache: Collection<number, { id: number; name: string }> = skillCache,
): Promise<void> {
  const detail = await fetchCardById(cardId, fetcher);
  const message = await interaction.followUp({
    embeds: [buildSkillsEmbed(detail, skCache)],
    components: [buildPageRow('skills')],
    flags: MessageFlags.Ephemeral,
  });
  await attachPageCollector(
    interaction as ChatInputCommandInteraction,
    detail,
    message,
    skCache,
    fetcher,
  );
}
