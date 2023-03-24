const { SlashCommandBuilder } = require('discord.js');
const dayJs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const { getDbClient } = require('../database');

dayJs.extend(customParseFormat);

const dbClient = new getDbClient();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwish')
    .addUserOption(option => option.setName('user').setDescription('mention the person you want Dr. Vegapunk to wish.').setRequired(true))
    .addStringOption(option => option.setName('event').setDescription('select the event you want Dr. Vegapunk to remember').setRequired(true).addChoices(
      { name: 'Birthday', value: 'birthday' },
    ))
    .setDescription('Unwish the someone for an event'),
  async execute(interaction) {
    try {
      const userId = interaction.options.getUser('user', true).id;
      const event = interaction.options.getString('event', true);
      const userData = await dbClient.get(`USER_${userId}`);
      if (userData) {
        const monthAndDay = dayJs(userData[event]).format('MM-DD');
        const allWishes = await dbClient.get(`wish-${monthAndDay}`);
        const newWishes = allWishes.filter((wish) =>
          !(wish.id === userId && wish.event === event));
        await dbClient.set(`wish-${monthAndDay}`, newWishes);
        console.log(newWishes);
      }
      await interaction.reply('Okay, I won\'t wish them anymore.');
    } catch (error) {
      await interaction.reply(`I'm sorry, I cannot do this at this time. Try agaimn later.`);
    }
  }
}