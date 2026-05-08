import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

type HelpTopic = 'categories' | 'effect types';

const SKILL_CATEGORIES = [
  'green',
  'recovery',
  'velocity',
  'acceleration',
  'movement',
  'gate',
  'vision',
  'speed_debuff',
  'accel_debuff',
  'frenzy_debuff',
  'stamina_drain',
  'vision_debuff',
  'purple',
  'scenario',
  'unique',
  'unique_recovery',
  //'zenkai', Uncomment to enable JP-only skills
] as const;

const EFFECT_TYPES = [
  'Speed Stat Up',
  'Stamina Stat Up',
  'Power Stat Up',
  'Guts Stat Up',
  'Wit Stat Up',
  'All Stats Up',
  'Increase Current Speed',
  'Decrease Current Speed',
  'Increase Target Speed',
  //'Zenkai Spurt Acceleration', Uncomment to enable JP-only skills
  'Increase Acceleration',
  'Stamina Recovery',
  'Increase Field of View',
  'Increase Lane Movement Speed',
  'Change Lane',
  'Start Reaction Improvement',
  'Start Delay Added',
  'Increase Rush Time',
  'Decrease Rush Chance',
  'Use Random Rare Skills',
  'Evolved Skill Duration Up',
  'Runaway',
  'Debuff Immunity',
  'Activate Related Skills on All Uma',
] as const;

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
      const left = SKILL_CATEGORIES.slice(0, 9);
      const right = SKILL_CATEGORIES.slice(9);
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
