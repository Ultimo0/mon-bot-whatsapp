const { send } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "privatemode",
    description: "Active/désactive le mode privé (owner+whitelist seulement)",
    public: false,

    async execute({ sock, remoteJid, args, isOwner }) {
        if (!isOwner) return;
        const option = args[0];

        if (option === "on") {
            config.setSetting("privateMode", true);
            return send(sock, remoteJid, "🔒 Mode privé ACTIVÉ", "lock");
        }
        if (option === "off") {
            config.setSetting("privateMode", false);
            return send(sock, remoteJid, "🔓 Mode public ACTIVÉ", "success");
        }
        if (option === "status") {
            const mode = config.settings.privateMode ? "🔒 Privé" : "🔓 Public";
            const count = config.getWhitelist().length;
            return send(sock, remoteJid, `Statut: ${mode}\nWhitelist: ${count}`, "info");
        }
        return send(sock, remoteJid, `!privatemode on/off/status`, "warn");
    }
};