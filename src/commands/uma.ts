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
import { cardCache, umaCache } from '../cache';
import { fetchUmaById, Fetcher } from '../api/client';
import { UmaDetail, UmaIndex } from '../types';
import { formatUmaVersion } from '../utils/formatters';
import { renderSkill } from './skill';

export const data = new SlashCommandBuilder()
  .setName('uma')
  .setDescription('Look up an umamusume')
  .addStringOption((option) =>
    option.setName('name').setDescription('The umamusume to look up').setRequired(true),
  );

const ACQUISITION_ORDER = ['Unique', 'Innate', 'Awakening', 'Event'];
// Simply add `Evolution` at the end of the array to enable evo skills once they're in global

const EASTER_EGG = '1440759949436125266';

export function buildDetailsEmbed(detail: UmaDetail): EmbedBuilder {
  const slug = detail.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const url = `https://gametora.com/umamusume/characters/${detail.id}-${slug}`;

  return new EmbedBuilder()
    .setTitle(detail.name)
    .setURL(url)
    .setDescription(formatUmaVersion(detail.subtitle) + formatReleaseDate(detail))
    .setFooter({ text: 'Uma Details page      source: gametora.com' })
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

export function formatReleaseDate(uma: UmaDetail): string {
  if (uma.is_predicted_date) {
    const [year, month] = uma.release_date.split('-');
    const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('en', {
      month: 'long',
    });
    return `\nExpected release: ${monthName} ${year}`;
  }
  return `\nRelease date: ${uma.release_date.replace(/-/g, '/')}`;
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
    value: `\`\`\`${skillsByAcquisition[acquisition].join(' - ')}\`\`\``,
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
    .setDescription(formatUmaVersion(detail.subtitle) + ' ' + formatReleaseDate(detail))
    .setFooter({ text: 'Uma Skills page     source: gametora' })
    .addFields(...skillFields);
}

export function buildPageRow(currentPage: 'details' | 'skills'): ActionRowBuilder<ButtonBuilder> {
  const toggleButton = new ButtonBuilder()
    .setCustomId('uma_toggle')
    .setLabel(currentPage === 'details' ? 'View Skills' : 'View Details')
    .setStyle(ButtonStyle.Secondary);

  if (currentPage === 'skills') {
    const browseButton = new ButtonBuilder()
      .setCustomId('uma_skill_browse')
      .setLabel('View a Skill')
      .setStyle(ButtonStyle.Primary);
    return new ActionRowBuilder<ButtonBuilder>().addComponents(toggleButton, browseButton);
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(toggleButton);
}

async function attachToggleCollector(
  message: Message,
  userId: string,
  detail: UmaDetail,
  fetcher: Fetcher = fetch,
): Promise<void> {
  let currentPage: 'details' | 'skills' = 'details';

  const nonEvoSkills = Array.from(
    new Map(
      detail.skills
        .filter(
          (s) => s.acquisition.charAt(0).toUpperCase() + s.acquisition.slice(1) !== 'Evolution',
        )
        .map((s) => [s.id, s]),
    ).values(),
  );

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) =>
      (i.customId === 'uma_toggle' || i.customId === 'uma_skill_browse') && i.user.id === userId,
    time: 120_000,
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'uma_toggle') {
      currentPage = currentPage === 'details' ? 'skills' : 'details';
      const embed =
        currentPage === 'details' ? buildDetailsEmbed(detail) : buildSkillsEmbed(detail);
      await i.update({ embeds: [embed], components: [buildPageRow(currentPage)] });
      return;
    }

    if (i.customId === 'uma_skill_browse') {
      const options = nonEvoSkills
        .slice(0, 25)
        .map((skill) =>
          new StringSelectMenuOptionBuilder().setLabel(skill.name).setValue(String(skill.id)),
        );

      const select = new StringSelectMenuBuilder()
        .setCustomId('uma_skill_select')
        .setPlaceholder('Select a skill')
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      const { resource } = await i.reply({
        content: 'Select a skill to look up:',
        components: [row],
        flags: MessageFlags.Ephemeral,
        withResponse: true,
      });

      const selectMessage = resource!.message!;

      try {
        const selected = await selectMessage.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          filter: (s) => s.customId === 'uma_skill_select' && s.user.id === userId,
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
    }
  });

  collector.on('end', () => {
    message.edit({ components: [] }).catch(() => undefined);
  });
}

export async function renderUma(
  interaction: RepliableInteraction,
  umaId: number,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const detail = await fetchUmaById(umaId, fetcher);
  const message = await interaction.followUp({
    embeds: [buildDetailsEmbed(detail)],
    components: [buildPageRow('details')],
    flags: MessageFlags.Ephemeral,
  });
  await attachToggleCollector(message, interaction.user.id, detail, fetcher);
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  cache: Collection<number, UmaIndex> = umaCache,
  fetcher: Fetcher = fetch,
) {
  const query = interaction.options.getString('name', true).toLowerCase();

  if (query === 'binch') {
    const sticker = await interaction.guild?.stickers.fetch(EASTER_EGG);
    if (sticker && interaction.channel && interaction.channel.isSendable()) {
      await interaction.reply({ content: '\u200b', flags: MessageFlags.Ephemeral });
      await interaction.channel.send({ stickers: [sticker] });
    }
    return;
  }

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
    await interaction.editReply({
      embeds: [buildDetailsEmbed(detail)],
      components: [buildPageRow('details')],
    });
    const message = await interaction.fetchReply();
    await attachToggleCollector(message, interaction.user.id, detail, fetcher);
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

  const { resource } = await interaction.reply({
    content: `Multiple umamusume found for "${query}". Please select one:`,
    components: [row],
    flags: MessageFlags.Ephemeral,
    withResponse: true,
  });

  const reply = resource!.message!;

  try {
    const i = await reply.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.customId === 'uma_select' && i.user.id === interaction.user.id,
      time: 30_000,
    });

    await i.deferUpdate();
    const detail = await fetchUmaById(Number(i.values[0]), fetcher);
    await interaction.deleteReply();
    const followUp = await interaction.followUp({
      components: [buildPageRow('details')],
      embeds: [buildDetailsEmbed(detail)],
    });
    await attachToggleCollector(followUp, interaction.user.id, detail, fetcher);
  } catch {
    try {
      await interaction.editReply({ content: 'Timed out.', components: [] });
    } catch {
      await interaction.followUp({ content: 'Timed out.', flags: MessageFlags.Ephemeral });
    }
  }
}
