// ===============================
// 📦 MODULE DATABASE (SQLite avec sqlite3)
// ===============================
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const { clean } = require("./helpers");

// Créer le dossier data s'il n'existe pas
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("📁 Dossier data créé");
}

const dbPath = path.join(dataDir, "bot.db");
const db = new sqlite3.Database(dbPath);

// ===============================
// 🔧 FONCTIONS ASYNCHRONES (promisify)
// ===============================
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// ===============================
// 🔧 CRÉATION DES TABLES
// ===============================
(async () => {
    await run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
    await run(`CREATE TABLE IF NOT EXISTS whitelist (jid TEXT PRIMARY KEY)`);
    await run(`CREATE TABLE IF NOT EXISTS owners (jid TEXT PRIMARY KEY)`);
    await run(`CREATE TABLE IF NOT EXISTS command_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_jid TEXT,
        command TEXT,
        group_jid TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await run(`CREATE TABLE IF NOT EXISTS group_settings (
        group_jid TEXT PRIMARY KEY,
        welcome_enabled INTEGER DEFAULT 0,
        welcome_message TEXT,
        goodbye_enabled INTEGER DEFAULT 0,
        goodbye_message TEXT
    )`);
    await run(`CREATE TABLE IF NOT EXISTS group_msg_spam (
        group_jid TEXT,
        user_jid TEXT,
        timestamp INTEGER,
        PRIMARY KEY (group_jid, user_jid, timestamp)
    )`);
    await run(`CREATE TABLE IF NOT EXISTS group_spam_offenses (
        group_jid TEXT,
        user_jid TEXT,
        warned INTEGER DEFAULT 0,
        PRIMARY KEY (group_jid, user_jid)
    )`);
    await run(`CREATE TABLE IF NOT EXISTS group_msg_mutes (
        group_jid TEXT,
        user_jid TEXT,
        until INTEGER,
        PRIMARY KEY (group_jid, user_jid)
    )`);
    // Table anti-link
    await run(`CREATE TABLE IF NOT EXISTS group_antilink_settings (
        group_jid TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 0,
        warn_limit INTEGER DEFAULT 3,
        warn_message TEXT
    )`);
    await run(`CREATE TABLE IF NOT EXISTS group_antilink_warnings (
        group_jid TEXT,
        user_jid TEXT,
        count INTEGER DEFAULT 0,
        PRIMARY KEY (group_jid, user_jid)
    )`);
    console.log("✅ Base de données initialisée");
})();

// ===============================
// 📝 SETTINGS
// ===============================
async function getSetting(key, defaultValue = null) {
    const row = await get("SELECT value FROM settings WHERE key = ?", [key]);
    if (!row) return defaultValue;
    try {
        return JSON.parse(row.value);
    } catch {
        return row.value;
    }
}

async function setSetting(key, value) {
    const serialized = JSON.stringify(value);
    await run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, serialized]);
}

// ===============================
// 👥 WHITELIST
// ===============================
async function addToWhitelist(jid) {
    const cleanJid = clean(jid);
    await run("INSERT OR IGNORE INTO whitelist (jid) VALUES (?)", [cleanJid]);
}

async function removeFromWhitelist(jid) {
    const cleanJid = clean(jid);
    await run("DELETE FROM whitelist WHERE jid = ?", [cleanJid]);
}

async function getWhitelist() {
    const rows = await all("SELECT jid FROM whitelist");
    return rows.map(row => row.jid);
}

async function isWhitelisted(jid) {
    const cleanJid = clean(jid);
    const row = await get("SELECT 1 FROM whitelist WHERE jid = ?", [cleanJid]);
    return !!row;
}

// ===============================
// 👑 OWNERS
// ===============================
async function addOwner(jid) {
    const cleanJid = clean(jid);
    await run("INSERT OR IGNORE INTO owners (jid) VALUES (?)", [cleanJid]);
}

async function removeOwner(jid) {
    const cleanJid = clean(jid);
    await run("DELETE FROM owners WHERE jid = ?", [cleanJid]);
}

async function getOwners() {
    const rows = await all("SELECT jid FROM owners");
    return rows.map(row => row.jid);
}

async function isOwner(jid) {
    const cleanJid = clean(jid);
    const row = await get("SELECT 1 FROM owners WHERE jid = ?", [cleanJid]);
    return !!row;
}

// ===============================
// 📜 LOGS
// ===============================
async function logCommand(userJid, command, groupJid = null) {
    await run("INSERT INTO command_logs (user_jid, command, group_jid) VALUES (?, ?, ?)", [userJid, command, groupJid]);
}

// ===============================
// 🏘️ GROUP SETTINGS (welcome/goodbye)
// ===============================
async function getGroupSettings(groupJid) {
    let row = await get("SELECT * FROM group_settings WHERE group_jid = ?", [groupJid]);
    if (!row) {
        return {
            group_jid: groupJid,
            welcome_enabled: 0,
            welcome_message: "Bienvenue {name} dans le groupe ! 🎉",
            goodbye_enabled: 0,
            goodbye_message: "{name} a quitté le groupe. Au revoir ! 👋"
        };
    }
    return row;
}

async function setGroupWelcome(groupJid, enabled, message = null) {
    const settings = await getGroupSettings(groupJid);
    const welcomeMessage = message !== null ? message : settings.welcome_message;
    await run(`INSERT OR REPLACE INTO group_settings (group_jid, welcome_enabled, welcome_message, goodbye_enabled, goodbye_message)
        VALUES (?, ?, ?, ?, ?)`, [groupJid, enabled ? 1 : 0, welcomeMessage, settings.goodbye_enabled, settings.goodbye_message]);
}

async function setGroupGoodbye(groupJid, enabled, message = null) {
    const settings = await getGroupSettings(groupJid);
    const goodbyeMessage = message !== null ? message : settings.goodbye_message;
    await run(`INSERT OR REPLACE INTO group_settings (group_jid, welcome_enabled, welcome_message, goodbye_enabled, goodbye_message)
        VALUES (?, ?, ?, ?, ?)`, [groupJid, settings.welcome_enabled, settings.welcome_message, enabled ? 1 : 0, goodbyeMessage]);
}

// ===============================
// 🚫 ANTI-SPAM (messages)
// ===============================
async function addMsgSpamViolation(groupJid, userJid, timestamp = Date.now()) {
    await run("INSERT INTO group_msg_spam (group_jid, user_jid, timestamp) VALUES (?, ?, ?)", 
        [clean(groupJid), clean(userJid), timestamp]);
}

async function countMsgSpamViolations(groupJid, userJid, since) {
    const row = await get("SELECT COUNT(*) as count FROM group_msg_spam WHERE group_jid = ? AND user_jid = ? AND timestamp > ?",
        [clean(groupJid), clean(userJid), since]);
    return row ? row.count : 0;
}

async function clearOldMsgViolations(olderThan) {
    await run("DELETE FROM group_msg_spam WHERE timestamp < ?", [olderThan]);
}

async function hasBeenWarned(groupJid, userJid) {
    const row = await get("SELECT warned FROM group_spam_offenses WHERE group_jid = ? AND user_jid = ?",
        [clean(groupJid), clean(userJid)]);
    return row ? row.warned === 1 : false;
}

async function setWarned(groupJid, userJid) {
    await run("INSERT OR REPLACE INTO group_spam_offenses (group_jid, user_jid, warned) VALUES (?, ?, 1)",
        [clean(groupJid), clean(userJid)]);
}

async function clearWarned(groupJid, userJid) {
    await run("DELETE FROM group_spam_offenses WHERE group_jid = ? AND user_jid = ?",
        [clean(groupJid), clean(userJid)]);
}

async function addMsgMute(groupJid, userJid, durationMs) {
    const until = Date.now() + durationMs;
    await run("INSERT OR REPLACE INTO group_msg_mutes (group_jid, user_jid, until) VALUES (?, ?, ?)",
        [clean(groupJid), clean(userJid), until]);
}

async function isMsgMuted(groupJid, userJid) {
    const row = await get("SELECT until FROM group_msg_mutes WHERE group_jid = ? AND user_jid = ?",
        [clean(groupJid), clean(userJid)]);
    if (!row) return false;
    if (row.until > Date.now()) return true;
    await run("DELETE FROM group_msg_mutes WHERE group_jid = ? AND user_jid = ?",
        [clean(groupJid), clean(userJid)]);
    return false;
}

async function removeMsgMute(groupJid, userJid) {
    await run("DELETE FROM group_msg_mutes WHERE group_jid = ? AND user_jid = ?",
        [clean(groupJid), clean(userJid)]);
}

// ===============================
// 🚫 ANTI-LINK
// ===============================
async function getAntilinkSettings(groupJid) {
    const row = await get("SELECT * FROM group_antilink_settings WHERE group_jid = ?", [groupJid]);
    if (!row) {
        return {
            group_jid: groupJid,
            enabled: 0,
            warn_limit: 3,
            warn_message: "⚠️ *ATTENTION* ⚠️\n\nVous avez envoyé un lien interdit.\nAvertissement {current}/{max}\n\nProchain avertissement = expulsion."
        };
    }
    return row;
}

async function setAntilinkEnabled(groupJid, enabled) {
    const settings = await getAntilinkSettings(groupJid);
    await run(`INSERT OR REPLACE INTO group_antilink_settings (group_jid, enabled, warn_limit, warn_message)
        VALUES (?, ?, ?, ?)`, [groupJid, enabled ? 1 : 0, settings.warn_limit, settings.warn_message]);
}

async function setAntilinkWarnLimit(groupJid, limit) {
    const settings = await getAntilinkSettings(groupJid);
    await run(`INSERT OR REPLACE INTO group_antilink_settings (group_jid, enabled, warn_limit, warn_message)
        VALUES (?, ?, ?, ?)`, [groupJid, settings.enabled, limit, settings.warn_message]);
}

async function setAntilinkWarnMessage(groupJid, message) {
    const settings = await getAntilinkSettings(groupJid);
    await run(`INSERT OR REPLACE INTO group_antilink_settings (group_jid, enabled, warn_limit, warn_message)
        VALUES (?, ?, ?, ?)`, [groupJid, settings.enabled, settings.warn_limit, message]);
}

async function getAntilinkWarnings(groupJid, userJid) {
    const row = await get("SELECT count FROM group_antilink_warnings WHERE group_jid = ? AND user_jid = ?", 
        [groupJid, clean(userJid)]);
    return row ? row.count : 0;
}

async function addAntilinkWarning(groupJid, userJid) {
    const current = await getAntilinkWarnings(groupJid, userJid);
    const newCount = current + 1;
    await run(`INSERT OR REPLACE INTO group_antilink_warnings (group_jid, user_jid, count) VALUES (?, ?, ?)`,
        [groupJid, clean(userJid), newCount]);
    return newCount;
}

async function resetAntilinkWarnings(groupJid, userJid) {
    await run("DELETE FROM group_antilink_warnings WHERE group_jid = ? AND user_jid = ?", 
        [groupJid, clean(userJid)]);
}

// ===============================
// 🚀 EXPORT
// ===============================
module.exports = {
    // Settings
    getSetting, setSetting,
    // Whitelist
    addToWhitelist, removeFromWhitelist, getWhitelist, isWhitelisted,
    // Owners
    addOwner, removeOwner, getOwners, isOwner,
    // Logs
    logCommand,
    // Group settings (welcome/goodbye)
    getGroupSettings, setGroupWelcome, setGroupGoodbye,
    // Anti-spam
    addMsgSpamViolation, countMsgSpamViolations, clearOldMsgViolations,
    hasBeenWarned, setWarned, clearWarned,
    addMsgMute, isMsgMuted, removeMsgMute,
    // Anti-link
    getAntilinkSettings, setAntilinkEnabled, setAntilinkWarnLimit, setAntilinkWarnMessage,
    getAntilinkWarnings, addAntilinkWarning, resetAntilinkWarnings
};