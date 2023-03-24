const Client = require('@replit/database');

let db;

function getDbClient() {
  if (!db) {
    db = new Client();
  }
  return db;
}

module.exports = {
  getDbClient
};
