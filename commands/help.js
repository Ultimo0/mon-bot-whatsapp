const { send } = require("../lib/helpers");

module.exports = {
    name: "help",
    description: "Affiche l'aide détaillée",
    public: true,

    async execute({ sock, remoteJid, commands, prefix, isOwner }) {
        let msg = "📖 *Aide détaillée*\n\n";
        for (const [name, cmd] of Object.entries(commands)) {
            const access = cmd.public !== false ? "🌍 Public" : "👑 Owner";
            const groupOnly = cmd.groupOnly ? " (groupe uniquement)" : "";
            const desc = cmd.description || "Pas de description";
            msg += `*${prefix}${name}* ${groupOnly}\n└ ${desc} [${access}]\n\n`;
        }
        await sock.sendMessage(remoteJid, { text: msg });
    }
};