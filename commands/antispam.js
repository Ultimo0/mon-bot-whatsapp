const { send } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "antispam",
    description: "Activer/désactiver l'anti-spam (4 messages/10s + suppression + expulsion)",
    public: false, // owner only

    async execute({ sock, remoteJid, args, isOwner }) {
        if (!isOwner) return;
        const option = args[0];
        if (option === "on") {
            config.setSetting("antispam_enabled", true);
            return send(sock, remoteJid, "✅ Anti-spam ACTIVÉ", "success");
        } else if (option === "off") {
            config.setSetting("antispam_enabled", false);
            return send(sock, remoteJid, "❌ Anti-spam DÉSACTIVÉ", "warn");
        } else {
            const status = config.getSetting("antispam_enabled", true);
            return send(sock, remoteJid, `📊 Anti-spam : ${status ? "Activé" : "Désactivé"}`, "info");
        }
    }
};