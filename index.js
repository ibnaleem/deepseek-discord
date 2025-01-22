import ollama from 'npm:ollama';
import OpenAI from "npm:openai";
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { REST, Routes } from 'discord.js';
import { Client, Collection, Events, GatewayIntentBits, Partials } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const token = Deno.env.get('DEEPSEEK_DISCORD_TOKEN');
let messages = []

if (!token) {
    throw new Error('(Line 10: const token) Token is not set in the environment variables.');
}

const clientId = '1331682455345959055';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages, GatewayIntentBits.DirectMessageTyping], partials: [Partials.Message, Partials.Channel, Partials.Reaction] });
client.commands = new Collection();
const commands = [];
const foldersPath = join(__dirname, 'commands');

for (const file of Deno.readDirSync(foldersPath)) {
    if (file.name.endsWith('.js')) {
        const filePath = join(foldersPath, file.name);
        
        try {
            const command = await import(`file://${filePath}`);

            const { data, execute } = command;
            if (data && execute) {
                client.commands.set(data.name, command);
                commands.push(data.toJSON());
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        } catch (error) {
            console.error(`[ERROR] Failed to import command at ${filePath}:`, error);
        }
    }
}

client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    readyClient.user.setPresence({ activities: [{ name: '/help' }], status: 'online' });
});


async function deepseekChat(userContent) {
  
  messages.push({ role: "user", content: userContent })

  const response = await ollama.chat({
    model: 'deepseek-r1:7b',
    messages: [{ role: 'user', content: 'Why is the sky blue?' }],
  });

  messages.push({ role: "assistant", content: response.message.content })

  return response.message.content
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  try {
    const response = await deepseekChat(message.content);
    await message.reply(response.message.content);
  } catch (error) {
    console.error('Error in deepseekChat or message.reply:', error);
  }
});
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();

client.login(token);