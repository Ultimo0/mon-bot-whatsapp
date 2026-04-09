const { send } = require("../lib/helpers");

module.exports = {
    name: "restart",
    description: "Redémarre le bot",
    public: false,

    async execute({ sock, remoteJid, isOwner }) {
        if (!isOwner) return;
        await send(sock, remoteJid, "♻️ Redémarrage...", "info");
        process.exit(0);
    }
};