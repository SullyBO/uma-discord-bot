import {
  Client,
  GatewayIntentBits,
  Collection,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import * as dotenvFlow from 'dotenv-flow';
import { fetchUmaIndex } from './api/client';
import { umaCache } from './cache';
import * as umaCommand from './commands/uma';
import * as umasCommand from './commands/umas';

dotenvFlow.config();

const commands = new Collection<
  string,
  { execute: (interaction: ChatInputCommandInteraction) => Promise<void> }
>();
commands.set(umaCommand.data.name, umaCommand);
commands.set(umasCommand.data.name, umasCommand);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function populateCache() {
  const umas = await fetchUmaIndex();
  umas.forEach((uma) => umaCache.set(uma.id, uma));
  console.log(`Cached ${umaCache.size} umas`);
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
