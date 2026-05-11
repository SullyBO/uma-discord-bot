import {
  Client,
  GatewayIntentBits,
  Collection,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import * as dotenvFlow from 'dotenv-flow';
import { fetchUmaIndex, fetchSkillIndex } from './api/client';
import { umaCache, skillCache } from './cache';
import * as umaCommand from './commands/uma';
import * as umasCommand from './commands/umas';
import * as skillCommand from './commands/skill';
import * as skillsCommand from './commands/skills';
import * as helpCommand from './commands/help';
import * as cmCommand from './commands/cm';

dotenvFlow.config();

const commands = new Collection<
  string,
  { execute: (interaction: ChatInputCommandInteraction) => Promise<void> }
>();
commands.set(umaCommand.data.name, umaCommand);
commands.set(umasCommand.data.name, umasCommand);
commands.set(skillCommand.data.name, skillCommand);
commands.set(skillsCommand.data.name, skillsCommand);
commands.set(helpCommand.data.name, helpCommand);
commands.set(cmCommand.data.name, cmCommand);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function populateCache() {
  const [umas, skills] = await Promise.all([fetchUmaIndex(), fetchSkillIndex()]);

  umas.forEach((uma) => umaCache.set(uma.id, uma));
  skills.forEach((skill) => skillCache.set(skill.id, skill));

  console.log(`Cached ${umaCache.size} umas, ${skillCache.size} skills`);
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  await populateCache();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.deferred) {
      await interaction.editReply({ content: 'Something went wrong.' });
    } else {
      await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
