const axios = require('axios');
const getDB = require('./db');
const crypto = require('crypto');
const querystring = require('querystring');



const ID_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const HELIX_SUBSCRIPTION_URL = 'https://api.twitch.tv/helix/eventsub/subscriptions';
const CALLBACK_URL = 'https://vegapunk1.terasurfer.repl.co/twitch';

const twitchClient = axios.create();

let authToken;
let expiry;

const isValidToken = () => {
  return authToken && expiry - Date.now() >= 0;
}

const getAuthToken = async () => {
  if (isValidToken()) return authToken;

  const qryStr = querystring.stringify({ 'client_id': process.env['TWITCH_CLIENT_ID'], 'client_secret': process.env['TWITCH_CLIENT_SECRET'], 'grant_type': 'client_credentials' });
  const response = await twitchClient.post(ID_TOKEN_URL, qryStr, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    }
  }).catch(err => console.log(err));
  authToken = response?.data?.access_token;
  expiry = (Date.now() + Number(response?.data?.expires_in)) - (30 * 1000);
  return authToken;
};

const registerStreamerEvent = async (userId, type = 'stream.online') => {
  const authToken = await getAuthToken();
  const secret = crypto.randomBytes(48).toString('base64url');
  const body = { type, "version": "1", "condition": { "broadcaster_user_id": "" + userId }, "transport": { "method": "webhook", "callback": CALLBACK_URL, secret } };
  await getDB().set("STREAMER_SECRET" + userId, secret);
  return await twitchClient.post(HELIX_SUBSCRIPTION_URL, body, {
    headers: {
      'Authorization': 'Bearer ' + authToken,
      'Client-Id': process.env['TWITCH_CLIENT_ID'],
      'Content-Type': 'application/json'
    }
  });
}

module.exports = { getAuthToken, registerStreamerEvent };