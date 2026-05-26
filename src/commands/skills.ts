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
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { fetchSkills, Fetcher } from '../api/client';
import { SkillSummary } from '../types';
import { CATEGORIES, EFFECT_TYPES, RARITIES } from '../constants/skills';
import { capitalize } from '../utils';
import { renderSkill } from './skill';

const activeCollectors = new Map<string, InteractionCollector<ButtonInteraction>>();

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

  if (rarity && !RARITIES.includes(rarity.toLowerCase())) {
    throw new Error(`"${rarity}" isn't a valid rarity. Valid options are: ${RARITIES.join(', ')}`);
  }

  if (category && !CATEGORIES.includes(category.toLowerCase())) {
    throw new Error(
      `"${category}" isn't a valid category. Valid options are:\n${CATEGORIES.map((c) => `• ${c}`).join('\n')}`,
    );
  }

  if (effect_type && !EFFECT_TYPES.includes(effect_type.toLowerCase())) {
    throw new Error(
      `"${effect_type}" isn't a valid effect type. Valid options are: ${EFFECT_TYPES.join(', ')}`,
    );
  }

  if (category) params.category = category.toLowerCase();
  if (rarity) params.rarity = rarity.toLowerCase();
  if (effect_type) params.effect_type = effect_type.toLowerCase();

  return params;
}

export function formatSummary(skill: SkillSummary): string {
  const costPart = skill.sp_cost > 0 ? ` | SP: ${skill.sp_cost}` : '';
  return [
    `**${skill.name}**`,
    `Category: ${capitalize(skill.category)} | Rarity: ${capitalize(skill.rarity)}${costPart}`,
    skill.ingame_description,
  ].join('\n');
}

export function buildPages(lines: string[]): string[] {
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += 4) {
    pages.push(lines.slice(i, i + 4).join('\n---\n'));
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

  const title = filterSummary ? `Skills - ${filterSummary}` : 'Skills';

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
    new ButtonBuilder()
      .setCustomId('skills_view')
      .setLabel('View a Skill')
      .setStyle(ButtonStyle.Primary),
  );
}

export async function execute(interaction: ChatInputCommandInteraction, fetcher: Fetcher = fetch) {
  const userId = interaction.user.id;
  let params: Record<string, string>;
  try {
    params = buildParams(interaction);
  } catch (e) {
    await interaction.reply({ content: (e as Error).message, flags: MessageFlags.Ephemeral });
    return;
  }

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

  activeCollectors.get(userId)?.stop();

  await interaction.editReply({
    embeds: [buildEmbed(pages[pageIndex], pageIndex, pages.length, params)],
    components: [buildRow(pageIndex, pages.length)],
  });

  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) =>
      (i.customId === 'skills_prev' ||
        i.customId === 'skills_next' ||
        i.customId === 'skills_view') &&
      i.user.id === userId,
    time: 120_000,
  });

  if (collector) {
    activeCollectors.set(userId, collector);

    collector.on('collect', async (i) => {
      if (i.customId === 'skills_prev') pageIndex = Math.max(0, pageIndex - 1);
      if (i.customId === 'skills_next') pageIndex = Math.min(pages.length - 1, pageIndex + 1);

      if (i.customId === 'skills_view') {
        const pageSkills = skills.slice(pageIndex * 4, pageIndex * 4 + 4);

        const select = new StringSelectMenuBuilder()
          .setCustomId('skills_view_select')
          .setPlaceholder('Select a skill')
          .addOptions(
            pageSkills.map((skill) =>
              new StringSelectMenuOptionBuilder().setLabel(skill.name).setValue(String(skill.id)),
            ),
          );

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
            filter: (s) => s.customId === 'skills_view_select' && s.user.id === userId,
            time: 30_000,
          });

          await selected.deferUpdate();
          await i.deleteReply();
          await renderSkill(selected, Number(selected.values[0]), fetcher);
        } catch {
          try {
            await i.editReply({ content: 'Timed out.', components: [] });
          } catch {}
        }
        return;
      }

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
