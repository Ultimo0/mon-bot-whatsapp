const { send } = require("../lib/helpers");

module.exports = {
    name: "ping",
    description: "Test de latence",
    public: true,

    async execute({ sock, remoteJid }) {
        await send(sock, remoteJid, "Pong !", "success");
    }
};