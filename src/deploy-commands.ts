import { REST, Routes } from 'discord.js';
import * as dotenvFlow from 'dotenv-flow';
import { data as umaCommand } from './commands/uma';

dotenvFlow.config();

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.CLIENT_ID!;

const commands = [umaCommand.toJSON()];

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Done.');
  } catch (error) {
    console.error(error);
  }
})();
