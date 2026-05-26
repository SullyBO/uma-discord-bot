import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Collection,
  ComponentType,
  EmbedBuilder,
  Message,
  MessageFlags,
  RepliableInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { fetchSkillById, Fetcher } from '../api/client';
import { cardCache, skillCache, umaCache } from '../cache';
import {
  CardIndex,
  InheritedSkill,
  SkillAcquisitionEntry,
  SkillCondition,
  SkillDetail,
  SkillIndex,
  SkillTrigger,
  UmaIndex,
} from '../types';
import {
  capitalize,
  formatCardType,
  formatOperator,
  formatRarity,
  formatUmaVersion,
} from '../utils';

type SkillPage = 'detail' | 'inherited' | 'acquisitions';

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

function formatTriggerLines(triggers: SkillTrigger[]): string[] {
  return triggers.map((t, i) => {
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
    if (t.scaling) parts.push(`**Special Scaling:** ${t.scaling}`);
    if (preconditions) parts.push(`**Preconditions:** ${preconditions}`);
    if (conditions) parts.push(`**Conditions:** ${conditions}`);

    return parts.join('\n');
  });
}

function chunkAcquisitionField(lines: string[]): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > 1024) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildAcquisitionFields(
  acquisitions: SkillAcquisitionEntry[],
  umas: Collection<number, UmaIndex>,
  cards: Collection<number, CardIndex>,
): { name: string; value: string; inline: boolean }[] {
  const fields: { name: string; value: string; inline: boolean }[] = [];

  function buildGroupedField(
    entries: SkillAcquisitionEntry[],
    resolve: (a: SkillAcquisitionEntry) => string,
  ): string {
    const groups = new Map<string, string[]>();
    for (const a of entries) {
      const name = resolve(a);
      if (!groups.has(a.acquisition)) groups.set(a.acquisition, []);
      groups.get(a.acquisition)!.push(name);
    }
    return Array.from(groups.entries())
      .map(([acq, names]) => `*via ${acq}:*\n${names.join('\n')}`)
      .join('\n\n');
  }

  const umaEntries = acquisitions.filter((a) => a.source_type === 'uma');
  const cardEntries = acquisitions.filter((a) => a.source_type === 'support_card');

  if (cardEntries.length > 0) {
    const value = buildGroupedField(cardEntries, (a) => {
      const card = cards.get(a.source_id);
      return card
        ? `${formatCardType(card.card_type)}${card.char_name} ${formatRarity(card.rarity)}`
        : `Unknown Card #${a.source_id}`;
    });
    chunkAcquisitionField(value.split('\n')).forEach((chunk, i) => {
      fields.push({
        name: i === 0 ? 'Acquired by Support Cards' : '\u200b',
        value: chunk,
        inline: true,
      });
    });
  }

  if (umaEntries.length > 0) {
    const value = buildGroupedField(umaEntries, (a) => {
      const uma = umas.get(a.source_id);
      return uma ? `${uma.name} (${formatUmaVersion(uma.version)})` : `Unknown Uma #${a.source_id}`;
    });
    chunkAcquisitionField(value.split('\n')).forEach((chunk, i) => {
      fields.push({
        name: i === 0 ? 'Builtin for Umas' : '\u200b',
        value: chunk,
        inline: true,
      });
    });
  }

  if (fields.length === 0) {
    fields.push({ name: 'Acquisitions', value: 'No acquisition data available.', inline: false });
  }

  return fields;
}

export function buildSkillDetailEmbed(detail: SkillDetail): EmbedBuilder {
  const triggerLines = formatTriggerLines(detail.triggers);

  return new EmbedBuilder()
    .setTitle(detail.name)
    .setDescription(detail.ingame_description || null)
    .addFields(
      { name: 'Category', value: capitalize(detail.category), inline: true },
      { name: 'Rarity', value: capitalize(detail.rarity), inline: true },
      ...(detail.sp_cost > 0
        ? [{ name: 'SP Cost', value: String(detail.sp_cost), inline: true }]
        : []),
      ...(triggerLines.length > 0
        ? [{ name: '', value: triggerLines.join('\n\n'), inline: false }]
        : []),
    )
    .setFooter({ text: 'src: gametora.com | Detail page' });
}

export function buildSkillInheritedEmbed(detail: SkillDetail): EmbedBuilder {
  const inherited = detail.inherited_skill as InheritedSkill;
  const triggerLines = formatTriggerLines(inherited.triggers);

  return new EmbedBuilder()
    .setTitle(`${detail.name} — Inherited Skill`)
    .setDescription(`**${inherited.name}**\n${inherited.ingame_description || ''}`)
    .addFields(
      { name: 'Category', value: capitalize(inherited.category), inline: true },
      { name: 'Rarity', value: capitalize(inherited.rarity), inline: true },
      ...(inherited.sp_cost > 0
        ? [{ name: 'SP Cost', value: String(inherited.sp_cost), inline: true }]
        : []),
      ...(triggerLines.length > 0
        ? [{ name: '', value: triggerLines.join('\n\n'), inline: false }]
        : []),
    )
    .setFooter({ text: 'src: gametora.com | Inherited Skill page' });
}

export function buildSkillAcquisitionsEmbed(
  detail: SkillDetail,
  umas: Collection<number, UmaIndex>,
  cards: Collection<number, CardIndex>,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(detail.name)
    .setDescription(detail.ingame_description || null)
    .addFields(...buildAcquisitionFields(detail.acquisitions, umas, cards))
    .setFooter({ text: 'src: gametora.com | Acquisitions page' });
}

function buildSkillEmbed(
  detail: SkillDetail,
  page: SkillPage,
  umas: Collection<number, UmaIndex>,
  cards: Collection<number, CardIndex>,
): EmbedBuilder {
  if (page === 'acquisitions') return buildSkillAcquisitionsEmbed(detail, umas, cards);
  if (page === 'inherited') return buildSkillInheritedEmbed(detail);
  return buildSkillDetailEmbed(detail);
}

export function buildSkillPageButtons(
  page: SkillPage,
  hasInherited: boolean,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('skill_detail')
      .setLabel('Detail')
      .setStyle(page === 'detail' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(page === 'detail'),
  );

  if (hasInherited) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('skill_inherited')
        .setLabel('Inherited Skill')
        .setStyle(page === 'inherited' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(page === 'inherited'),
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('skill_acquisitions')
      .setLabel('Acquisitions')
      .setStyle(page === 'acquisitions' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(page === 'acquisitions'),
  );

  return row;
}

const PAGE_BUTTON_IDS = ['skill_detail', 'skill_inherited', 'skill_acquisitions'] as const;

const BUTTON_PAGE_MAP: Record<string, SkillPage> = {
  skill_detail: 'detail',
  skill_inherited: 'inherited',
  skill_acquisitions: 'acquisitions',
};

async function attachPageCollector(
  message: Message,
  userId: string,
  detail: SkillDetail,
  umas: Collection<number, UmaIndex>,
  cards: Collection<number, CardIndex>,
): Promise<void> {
  let currentPage: SkillPage = 'detail';
  const hasInherited = detail.inherited_skill !== null;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) =>
      (PAGE_BUTTON_IDS as readonly string[]).includes(i.customId) && i.user.id === userId,
    time: 120_000,
  });

  collector.on('collect', async (i) => {
    currentPage = BUTTON_PAGE_MAP[i.customId] ?? 'detail';
    await i.update({
      embeds: [buildSkillEmbed(detail, currentPage, umas, cards)],
      components: [buildSkillPageButtons(currentPage, hasInherited)],
    });
  });

  collector.on('end', () => {
    message.edit({ components: [] }).catch(() => undefined);
  });
}

async function showSkill(
  interaction: ChatInputCommandInteraction,
  id: number,
  fetcher: Fetcher,
  umas: Collection<number, UmaIndex>,
  cards: Collection<number, CardIndex>,
): Promise<void> {
  const detail = await fetchSkillById(id, fetcher);
  const hasInherited = detail.inherited_skill !== null;
  await interaction.editReply({
    embeds: [buildSkillEmbed(detail, 'detail', umas, cards)],
    components: [buildSkillPageButtons('detail', hasInherited)],
  });
  const message = await interaction.fetchReply();
  await attachPageCollector(message, interaction.user.id, detail, umas, cards);
}

export async function renderSkill(
  interaction: RepliableInteraction,
  skillId: number,
  fetcher: Fetcher = fetch,
  umas: Collection<number, UmaIndex> = umaCache,
  cards: Collection<number, CardIndex> = cardCache,
): Promise<void> {
  const detail = await fetchSkillById(skillId, fetcher);
  const hasInherited = detail.inherited_skill !== null;
  const message = await interaction.followUp({
    embeds: [buildSkillEmbed(detail, 'detail', umas, cards)],
    components: [buildSkillPageButtons('detail', hasInherited)],
    flags: MessageFlags.Ephemeral,
  });
  await attachPageCollector(message, interaction.user.id, detail, umas, cards);
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  fetcher: Fetcher = fetch,
  cache: Collection<number, SkillIndex> = skillCache,
  umas: Collection<number, UmaIndex> = umaCache,
  cards: Collection<number, CardIndex> = cardCache,
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
    await showSkill(interaction, matches.first()!.id, fetcher, umas, cards);
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

  const { resource } = await interaction.reply({
    content: `Multiple skills matched "${query}". Please select one:`,
    components: [row],
    flags: MessageFlags.Ephemeral,
    withResponse: true,
  });

  const reply = resource!.message!;

  try {
    const i = await reply.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.customId === 'skill_select' && i.user.id === interaction.user.id,
      time: 60_000,
    });

    await i.deferUpdate();
    const detail = await fetchSkillById(Number(i.values[0]), fetcher);
    const hasInherited = detail.inherited_skill !== null;
    await interaction.deleteReply();
    const followUp = await interaction.followUp({
      embeds: [buildSkillEmbed(detail, 'detail', umas, cards)],
      components: [buildSkillPageButtons('detail', hasInherited)],
    });
    await attachPageCollector(followUp, interaction.user.id, detail, umas, cards);
  } catch {
    await interaction.editReply({ content: 'Timed out.', components: [] });
  }
}
