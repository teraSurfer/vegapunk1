const { SlashCommandBuilder } = require('discord.js');
const dayJs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const { getDbClient } = require('../database');

dayJs.extend(customParseFormat);

const dbClient = new getDbClient();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wish')
    .addUserOption(option => option.setName('user').setDescription('mention the person you want Dr. Vegapunk to wish.').setRequired(true))
    .addStringOption(option => option.setName('event').setDescription('select the event you want Dr. Vegapunk to remember').setRequired(true).addChoices(
      { name: 'Birthday', value: 'birthday' },
    ))
    .addStringOption(option => option.setName('date').setDescription('enter the date of the event in YYYY-MM-DD format').setRequired(true))
    .setDescription('Wish the someone for an event on the specified date'),
  async execute(interaction) {
    try {
      const date = interaction.options.getString('date', true);
      const user = interaction.options.getUser('user', true);
      const event = interaction.options.getString('event', true);
      if (!date || !dayJs(date, 'YYYY-MM-DD', true).isValid()) {
        await interaction.reply('I cannot wish someone on a date that doesn\'t exist');
      }
      const monthAndDay = dayJs(date).format('MM-DD');
      const dbEntries = await dbClient.get(`wish-${monthAndDay}`);
      const entries = [
        ...((dbEntries && dbEntries.length) ? dbEntries : []),
        {
          id: user.id,
          event,
        }
      ]
      await dbClient.set(`wish-${monthAndDay}`, entries);

      const userData = await dbClient.get(`USER_${user.id}`);
      const usrData = {
        ...(userData ? userData : {}),
        id: user.id,
        name: user.username,
        [event]: date,
      };
      await dbClient.set(`USER_${user.id}`, usrData);
      await interaction.reply(`Okay, I will wish them on ${monthAndDay}`);
    } catch (err) {
      await interaction.reply('I\'m sorry, I cannot wish them at this moment.');
    }
  }
}