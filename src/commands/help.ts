import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { CATEGORIES, EFFECT_TYPES } from '../constants/skills';

type HelpTopic = 'categories' | 'effect types';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Get help with command options')
  .addStringOption((option) =>
    option
      .setName('topic')
      .setDescription('What to get help with')
      .setRequired(true)
      .addChoices(
        { name: 'categories', value: 'categories' },
        { name: 'effect types', value: 'effect types' },
      ),
  );

export function buildEmbed(topic: HelpTopic): EmbedBuilder {
  switch (topic) {
    case 'categories': {
      const left = CATEGORIES.slice(0, 9);
      const right = CATEGORIES.slice(9);
      return new EmbedBuilder()
        .setTitle('Skill Categories (based on skill icons)')
        .addFields(
          { name: '\u200b', value: `\`\`\`${left.join('\n')}\`\`\``, inline: true },
          { name: '\u200b', value: `\`\`\`${right.join('\n')}\`\`\``, inline: true },
        );
    }
    case 'effect types': {
      const left = EFFECT_TYPES.slice(0, 12);
      const right = EFFECT_TYPES.slice(12);
      return new EmbedBuilder()
        .setTitle('Effect Types')
        .addFields(
          { name: '\u200b', value: `\`\`\`${left.join('\n')}\`\`\``, inline: true },
          { name: '\u200b', value: `\`\`\`${right.join('\n')}\`\`\``, inline: true },
        );
    }
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const topic = interaction.options.getString('topic', true) as HelpTopic;

  await interaction.reply({
    embeds: [buildEmbed(topic)],
    flags: MessageFlags.Ephemeral,
  });
}
