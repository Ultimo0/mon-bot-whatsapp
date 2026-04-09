// ===============================
// 📦 CONFIGURATION PRINCIPALE
// ===============================
require("dotenv").config();
const db = require("./lib/database");

module.exports = {
    // Préfixe des commandes
    prefix: "!",
    
    // Clé API météo (depuis .env)
    weatherApi: process.env.WEATHER_API,
    
    // Paramètres globaux (mode privé, etc.)
    get settings() {
        return {
            privateMode: db.getSetting("privateMode", true)
        };
    },
    
    // ===============================
    // 🔧 FONCTIONS D'ACCÈS À LA BASE
    // ===============================
    getSetting: db.getSetting,
    setSetting: db.setSetting,
    
    // 👥 Whitelist
    addToWhitelist: db.addToWhitelist,
    removeFromWhitelist: db.removeFromWhitelist,
    getWhitelist: db.getWhitelist,
    isWhitelisted: db.isWhitelisted,
    
    // 👑 Owners
    addOwner: db.addOwner,
    removeOwner: db.removeOwner,
    getOwners: db.getOwners,
    isOwner: db.isOwner,
    
    // 📜 Logs
    logCommand: db.logCommand,
    
    // 🏘️ Groupes (welcome / goodbye)
    getGroupSettings: db.getGroupSettings,
    setGroupWelcome: db.setGroupWelcome,
    setGroupGoodbye: db.setGroupGoodbye,
    
    // 🚫 Anti-spam (messages)
    addMsgSpamViolation: db.addMsgSpamViolation,
    countMsgSpamViolations: db.countMsgSpamViolations,
    clearOldMsgViolations: db.clearOldMsgViolations,
    hasBeenWarned: db.hasBeenWarned,
    setWarned: db.setWarned,
    clearWarned: db.clearWarned,
    addMsgMute: db.addMsgMute,
    isMsgMuted: db.isMsgMuted,
    removeMsgMute: db.removeMsgMute,
    
    // 🚫 Anti-link
    getAntilinkSettings: db.getAntilinkSettings,
    setAntilinkEnabled: db.setAntilinkEnabled,
    setAntilinkWarnLimit: db.setAntilinkWarnLimit,
    setAntilinkWarnMessage: db.setAntilinkWarnMessage,
    getAntilinkWarnings: db.getAntilinkWarnings,
    addAntilinkWarning: db.addAntilinkWarning,
    resetAntilinkWarnings: db.resetAntilinkWarnings
};