const { SlashCommandBuilder } = require('discord.js');

const replies = ['Alright, just this once. Pong!', 'I didn\'t eat nomi nomi no mi to play games with you.', 'Umm, this goes here... Sorry, what was your question again?', 'Please leave me alone.'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  async execute(interaction) {
    await interaction.reply(replies[Math.floor(Math.random() * replies.length)]);
  },
};