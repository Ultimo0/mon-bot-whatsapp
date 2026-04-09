const { send, clean } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "owner",
    description: "Gère les propriétaires du bot",
    public: false,

    async execute({ sock, remoteJid, msg, args, isOwner, senderJid }) {
        if (!isOwner) return;
        const action = args[0];

        if (action === "add") {
            let target = msg.message?.extendedTextMessage?.contextInfo?.participant || args[1] || senderJid;
            if (!target) return send(sock, remoteJid, "Reply ou !owner add 237xxx", "warn");
            const cleanTarget = clean(target);
            // Vérifier si déjà owner
            const already = await config.isOwner(cleanTarget);
            if (already) return send(sock, remoteJid, "⚠️ Déjà owner", "warn");
            await config.addOwner(cleanTarget);
            return send(sock, remoteJid, `👑 Ajouté : ${cleanTarget}`, "success");
        }

        if (action === "remove") {
            let target = msg.message?.extendedTextMessage?.contextInfo?.participant || args[1];
            if (!target) return send(sock, remoteJid, "Reply ou !owner remove", "warn");
            const cleanTarget = clean(target);
            await config.removeOwner(cleanTarget);
            return send(sock, remoteJid, "❌ Retiré", "success");
        }

        if (action === "list") {
            const owners = await config.getOwners();
            if (!owners.length) return send(sock, remoteJid, "Aucun owner", "info");
            const list = owners.map(o => "👑 " + o).join("\n");
            return send(sock, remoteJid, `👑 Owners:\n${list}`, "info");
        }

        return send(sock, remoteJid, `📘 !owner add/remove/list`, "info");
    }
};