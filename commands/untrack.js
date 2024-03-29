const { SlashCommandBuilder } = require('discord.js');
const twitchClient = require('../twitchClient');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untrack')
    .setDescription('untrack a twitch streamer')
    .addIntegerOption(option => option.setName('userid').setDescription('UserId of the twitch streamer')),
  async execute(interaction) {
    const id = interaction.options.getInteger('userid');
    if (!id) {
      await interaction.reply('Really? you want me to untrack nothing??');
      return;
    }

    await interaction.reply('I am trying, give me a moment please.');
    try {
      await twitchClient.registerStreamerEvent(id, 'stream.offline');
      await interaction.editReply('Done!');
    } catch (err) {
      console.log('ERR ==============', err);
      await interaction.editReply('Failed sorry, try again.');
    }
  },
};