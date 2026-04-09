const { send } = require("../lib/helpers");

module.exports = {
    name: "mode",
    description: "Indique si vous êtes propriétaire",
    public: true,

    async execute({ sock, remoteJid, isOwner }) {
        const msg = isOwner ? "Mode propriétaire actif" : "Mode utilisateur";
        const type = isOwner ? "owner" : "info";
        await send(sock, remoteJid, msg, type);
    }
};