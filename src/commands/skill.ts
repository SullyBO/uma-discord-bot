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
import { fetchSkillById, Fetcher } from '../api/client';
import { skillCache } from '../cache';
import { SkillCondition, SkillDetail, SkillIndex } from '../types';
import { formatOperator } from '../utils';

export const data = new SlashCommandBuilder()
  .setName('skill')
  .setDescription('Look up a skill by name')
  .addStringOption((option) =>
    option.setName('name').setDescription('The skill to look up').setRequired(true),
  );

function formatConditions(conditions: SkillCondition[]): string {
  const groups: string[][] = [];
  for (const c of conditions) {
    if (c.is_or || groups.length === 0) {
      groups.push([]);
    }
    groups[groups.length - 1].push(`${c.cond_key} ${formatOperator(c.operator)} ${c.cond_val}`);
  }
  return groups.map((g) => g.join(', ')).join('.\n*alternatively:* ');
}

function buildEmbed(detail: SkillDetail): EmbedBuilder {
  const triggerLines = detail.triggers.map((t, i) => {
    const effects = t.effects
      .map((e) => (e.effect_value !== null ? `${e.effect_type}: ${e.effect_value}` : e.effect_type))
      .join(', ');

    const preconditions = formatConditions(t.preconditions);
    const conditions = formatConditions(t.conditions);
    const duration =
      t.duration === null ? 'Infinite' : t.duration === 0 ? 'Instant' : `${t.duration}s`;

    const parts = [
      `**Trigger ${i + 1}**`,
      `**Effects:** ${effects || 'none'}`,
      `**Duration:** ${duration}`,
    ];
    if (preconditions) parts.push(`**Preconditions:** ${preconditions}`);
    if (conditions) parts.push(`**Conditions:** ${conditions}`);

    return parts.join('\n');
  });

  return new EmbedBuilder()
    .setTitle(detail.name)
    .addFields(
      { name: 'Category', value: detail.category, inline: true },
      { name: 'Rarity', value: detail.rarity, inline: true },
      ...(detail.sp_cost > 0
        ? [{ name: 'SP Cost', value: String(detail.sp_cost), inline: true }]
        : []),
    )
    .setDescription(triggerLines.join('\n\n') || 'No trigger data available.')
    .setFooter({ text: `src: gametora.com` });
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  fetcher: Fetcher = fetch,
  cache: Collection<number, SkillIndex> = skillCache,
) {
  const query = interaction.options.getString('name', true).toLowerCase();

  const matches = cache.filter((skill) => skill.name.toLowerCase().includes(query));

  if (matches.size === 0) {
    await interaction.reply({
      content: `No skill found for "${query}".`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (matches.size === 1) {
    await interaction.deferReply();
    const detail = await fetchSkillById(matches.first()!.id, fetcher);
    await interaction.editReply({ embeds: [buildEmbed(detail)] });
    return;
  }

  const options = matches
    .first(25)
    .map((skill) =>
      new StringSelectMenuOptionBuilder().setLabel(skill.name).setValue(String(skill.id)),
    );

  const select = new StringSelectMenuBuilder()
    .setCustomId('skill_select')
    .setPlaceholder('Select a skill')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const reply = await interaction.reply({
    content: `Multiple skills matched "${query}". Please select one:`,
    components: [row],
    flags: MessageFlags.Ephemeral,
    fetchReply: true,
  });

  try {
    const i = await reply.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.customId === 'skill_select' && i.user.id === interaction.user.id,
      time: 60_000,
    });

    await i.deferUpdate();
    const detail = await fetchSkillById(Number(i.values[0]), fetcher);
    await interaction.deleteReply();
    await interaction.followUp({ embeds: [buildEmbed(detail)] });
  } catch {
    await interaction.editReply({ content: 'Timed out.', components: [] });
  }
}
