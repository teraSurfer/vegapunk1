const Database = require('@replit/database');

let db;

/** @type {() => Database} */
const getDB = () => {
  if (!db) {
    db = new Database();
  }
  return db;
}

module.exports = getDB