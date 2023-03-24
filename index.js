const { Client, GatewayIntentBits, Collection, Events, REST, Routes, MessageAttachment } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const fetch = require('node-fetch');
const express = require('express');
const crypto = require('crypto');
const cron = require('node-cron')
const { getDbClient } = require('./database');
const dayjs = require('dayjs');

const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp'.toLowerCase();
const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature'.toLowerCase();
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

// Notification message types
const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
const MESSAGE_TYPE_NOTIFICATION = 'notification';
const MESSAGE_TYPE_REVOCATION = 'revocation';
const HMAC_PREFIX = 'sha256=';

const app = express();

const dbClient = new getDbClient();

app.use(express.raw({          // Need raw message body for signature verification
  type: 'application/json'
}))

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  // Set a new item in the Collection with the key as the command name and the value as the exported module
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

/** DISCORD APP */

client.on(Events.ClientReady, async client => {
  console.log(client.channels, 'listening on these...');
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

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

async function login() {
  try {
    const r = await client.login(process.env['TOKEN']);
    console.log('logged in', r);
  } catch (err) {
    console.log('failed to login', err);
  }
}

login();

const rest = new REST({ version: '10' }).setToken(process.env['TOKEN']);

/** CRON APP */

const punks = ['Dr. Vegapunk', 'Dr. Vegapunk 01 - Shaka', 'Dr. Vegapunk 02 - Lilith', 'Dr. Vegapunk 03 - Edison', 'Dr. Vegapunk 04 - Pythagoras', 'Dr. Vegapunk 05 - Atlas', 'Dr. Vegapunk 06 - York']

cron.schedule('0 0 0 * * *', async () => {
  const punkOfTheDay = Math.floor(Math.random() * punks.length);
  console.log('PUNK OF THE DAY ---', punks[punkOfTheDay]);
  await rest.patch(Routes.guildMember(process.env['GUILD_ID'], '@me'), {
    body: {
      nick: punks[punkOfTheDay],
    }
  });
  client.user.setAvatar(`./images/${punkOfTheDay}.png`);

  const wishes = await dbClient.get(`wish-${dayjs().format('MM-DD')}`);
  if (wishes) {
    for (const wish of wishes) {
      console.log(wish.id, wish.event);
      const url = `http://api.giphy.com/v1/gifs/search?q=${wish.event}   &api_key=${process.env.GIPHY_API_KEY}&limit=100`;
      const resp = await fetch(url);
      const json = await resp.json();
      const randomIndex = Math.floor(Math.random() * json.data.length);
      await rest.post(Routes.channelMessages(process.env['BIRTHDAYS_CHANNEL']), {
        body: {
          content: `@everyone, please wish <@${wish.id}> a very happy ${wish.event}! \n ${json.data[randomIndex].url}`
        }
      });
    }
  }
});

/** EXPRESS APP */

app.get('/', async (req, res) => {
  console.log(await dbClient.getAll());
  res.status(200).json({ message: 'OK' });
});

app.post('/twitch', async (req, res) => {
  let secret = getSecret();
  let message = getHmacMessage(req);
  let hmac = HMAC_PREFIX + getHmac(secret, message);  // Signature to compare
  if (true === verifyMessage(hmac, req.headers[TWITCH_MESSAGE_SIGNATURE])) {
    console.log("signatures match", JSON.parse(req.body), req.headers);

    // Get JSON object from body, so you can process the message.

    let notification = JSON.parse(req.body);

    if (MESSAGE_TYPE_NOTIFICATION === req.headers[MESSAGE_TYPE]) {
      // TODO: Do something with the event's data.

      console.log(`Event type: ${notification.subscription.type}`);
      console.log(JSON.stringify(notification.event, null, 4));
      const body = {};
      if (notification.subscription.type === 'stream.online') {
        body.content = `@everyone ${notification.event.broadcaster_user_name} is now online! catch their stream on https://www.twitch.tv/${notification.event.broadcaster_user_name}`
      }
      if (notification.subscription.type === 'stream.offline') {
        body.content = `${notification.event.broadcaster_user_name} is now offline sadge.`
      }

      await rest.post(Routes.channelMessages(process.env['DISCORD_CHANNEL']), { body });
      res.sendStatus(204);
    }
    else if (MESSAGE_TYPE_VERIFICATION === req.headers[MESSAGE_TYPE]) {
      res.status(200).send(notification.challenge);
    }
    else if (MESSAGE_TYPE_REVOCATION === req.headers[MESSAGE_TYPE]) {
      res.sendStatus(204);

      console.log(`${notification.subscription.type} notifications revoked!`);
      console.log(`reason: ${notification.subscription.status}`);
      console.log(`condition: ${JSON.stringify(notification.subscription.condition, null, 4)}`);
    }
    else {
      res.sendStatus(204);
      console.log(`Unknown message type: ${req.headers[MESSAGE_TYPE]}`);
    }
  }
  else {
    console.log('403');    // Signatures didn't match.
    res.sendStatus(403);
  }
});

app.listen(8080, '0.0.0.0', () => {
  console.log('Started bot server');
});

function getSecret() {
  // TODO: Get secret from secure storage. This is the secret you pass 
  // when you subscribed to the event.
  return 'mysupersecretkey';
}

// Build the message used to get the HMAC.
function getHmacMessage(request) {
  return (request.headers[TWITCH_MESSAGE_ID] +
    request.headers[TWITCH_MESSAGE_TIMESTAMP] +
    request.body);
}

// Get the HMAC.
function getHmac(secret, message) {
  return crypto.createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

// Verify whether our hash matches the hash that Twitch passed in the header.
function verifyMessage(hmac, verifySignature) {
  console.log(hmac, verifySignature);
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(verifySignature));
}