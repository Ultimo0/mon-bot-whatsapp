const { send, clean } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "whitelist",
    description: "Gère la whitelist (add/remove/list)",
    public: false,

    async execute({ sock, remoteJid, msg, args, isOwner, senderJid }) {
        if (!isOwner) return;
        const action = args[0];

        if (action === "add") {
            let target = msg.message?.extendedTextMessage?.contextInfo?.participant || senderJid;
            const cleanTarget = clean(target);
            // ⚠️ Attention : bien utiliser await
            const already = await config.isWhitelisted(cleanTarget);
            if (already) {
                return send(sock, remoteJid, "⚠️ Déjà whitelisté", "warn");
            }
            await config.addToWhitelist(cleanTarget);
            return send(sock, remoteJid, `✅ Ajouté : ${cleanTarget}`, "success");
        }

        if (action === "remove") {
            let target = msg.message?.extendedTextMessage?.contextInfo?.participant || args[1];
            if (!target) return send(sock, remoteJid, "Reply ou !whitelist remove numéro", "warn");
            const cleanTarget = clean(target);
            await config.removeFromWhitelist(cleanTarget);
            return send(sock, remoteJid, "❌ Retiré", "success");
        }

        if (action === "list") {
            const list = await config.getWhitelist();
            if (!list.length) return send(sock, remoteJid, "📭 Aucune whitelist", "info");
            const formatted = list.map(j => "➤ " + j).join("\n");
            return send(sock, remoteJid, `👥 Whitelist:\n${formatted}`, "info");
        }

        return send(sock, remoteJid, `📘 !whitelist add/remove/list`, "info");
    }
};