import { REST, Routes } from 'discord.js';
import * as dotenvFlow from 'dotenv-flow';
import { data as umaCommand } from './commands/uma';
import { data as umasCommand } from './commands/umas';
import { data as skillCommand } from './commands/skill';
import { data as skillsCommand } from './commands/skills';
import { data as helpCommand } from './commands/help';

dotenvFlow.config();

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.CLIENT_ID!;

const commands = [
  umaCommand.toJSON(),
  umasCommand.toJSON(),
  skillCommand.toJSON(),
  skillsCommand.toJSON(),
  helpCommand.toJSON(),
];

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash commands...`);
    commands.forEach((c) => console.log(` - /${c.name}`));
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Done.');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
})();
