import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { fetchSkills, Fetcher } from '../api/client';
import { SkillSummary } from '../types';

export const data = new SlashCommandBuilder()
  .setName('skills')
  .setDescription('List skills matching filters')
  .addStringOption((option) =>
    option
      .setName('category')
      .setDescription('Skill category (/help skill category for more info)')
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName('rarity')
      .setDescription('Skill rarity (i.e. normal, rare, unique.)')
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName('effect_type')
      .setDescription('Effect type as they are on gametora (/help skill effect type for more info)')
      .setRequired(false),
  );

export function buildParams(interaction: ChatInputCommandInteraction): Record<string, string> {
  const params: Record<string, string> = {};

  const category = interaction.options.getString('category');
  const rarity = interaction.options.getString('rarity');
  const effect_type = interaction.options.getString('effect_type');

  if (category) params.category = category.toLowerCase();
  if (rarity) params.rarity = rarity.toLowerCase();
  if (effect_type) params.effect_type = effect_type.toLowerCase();

  return params;
}

export function formatSummary(skill: SkillSummary): string {
  return [
    `**${skill.name}**`,
    `Category: ${skill.category} | Rarity: ${skill.rarity} | SP: ${skill.sp_cost}`,
  ].join('\n');
}

export function buildPages(lines: string[]): string[] {
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += 5) {
    pages.push(lines.slice(i, i + 5).join('\n---\n'));
  }
  return pages;
}

export function buildEmbed(
  page: string,
  pageIndex: number,
  totalPages: number,
  params: Record<string, string | boolean>,
): EmbedBuilder {
  const displayParams = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'is_jp_only'),
  );
  const filterSummary = Object.entries(displayParams)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');

  const title = filterSummary ? `Skills — ${filterSummary}` : 'Skills';

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(page)
    .setFooter({ text: `Page ${pageIndex + 1} of ${totalPages}      src: gametora.com` });
}

export function buildRow(pageIndex: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('skills_prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('skills_next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === totalPages - 1),
  );
}

export async function execute(interaction: ChatInputCommandInteraction, fetcher: Fetcher = fetch) {
  const params = buildParams(interaction);

  await interaction.deferReply();

  const skills = await fetchSkills(params, fetcher);

  if (skills.length === 0) {
    await interaction.editReply({ content: 'No skills found matching those filters.' });
    return;
  }

  const lines = skills.map(formatSummary);
  const pages = buildPages(lines);

  if (pages.length === 1) {
    await interaction.editReply({ embeds: [buildEmbed(pages[0], 0, 1, params)] });
    return;
  }

  let pageIndex = 0;

  await interaction.editReply({
    embeds: [buildEmbed(pages[pageIndex], pageIndex, pages.length, params)],
    components: [buildRow(pageIndex, pages.length)],
  });

  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) =>
      (i.customId === 'skills_prev' || i.customId === 'skills_next') &&
      i.user.id === interaction.user.id,
    time: 120_000,
  });

  collector?.on('collect', async (i) => {
    if (i.customId === 'skills_prev') pageIndex = Math.max(0, pageIndex - 1);
    if (i.customId === 'skills_next') pageIndex = Math.min(pages.length - 1, pageIndex + 1);

    await i.update({
      embeds: [buildEmbed(pages[pageIndex], pageIndex, pages.length, params)],
      components: [buildRow(pageIndex, pages.length)],
    });
  });

  collector?.on('end', async () => {
    await interaction.editReply({ components: [] });
  });
}
