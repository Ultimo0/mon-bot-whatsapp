const { send, clean } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "unban",
    description: "Retirer un membre de la blacklist (admin uniquement)",
    groupOnly: true,
    public: false,

    async execute({ sock, remoteJid, msg, args, isOwner, sender }) {
        // Vérifier admin
        let isUserAdmin = false;
        try {
            const metadata = await sock.groupMetadata(remoteJid);
            const participants = metadata.participants || [];
            const userClean = clean(sender);
            for (const p of participants) {
                if (clean(p.id) === userClean && (p.admin === "admin" || p.admin === "superadmin")) {
                    isUserAdmin = true;
                    break;
                }
            }
        } catch (err) {
            return send(sock, remoteJid, "❌ Impossible de vérifier les permissions", "error");
        }
        if (!isUserAdmin && !isOwner) {
            return send(sock, remoteJid, "⛔ Seuls les admins peuvent débannir", "error");
        }

        // Récupération de la cible
        let targetJid = null;
        let targetName = "cette personne";
        if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            targetJid = msg.message.extendedTextMessage.contextInfo.participant;
        } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (args[0]) {
            let arg = args[0].replace(/[^0-9]/g, "");
            if (arg.length >= 10) targetJid = arg + "@s.whatsapp.net";
        }

        if (!targetJid) {
            return send(sock, remoteJid, "📘 Utilisation : !unban @utilisateur", "warn");
        }

        const cleanTarget = clean(targetJid);
        try {
            const contact = await sock.getName(targetJid);
            if (contact && !contact.includes("@")) targetName = contact;
        } catch (err) {}

        // 🔧 CORRECTION : s'assurer que bannedGroups est un tableau
        let bannedGroups = await config.getSetting(`banned_${cleanTarget}`, []);
        if (!Array.isArray(bannedGroups)) {
            try {
                bannedGroups = JSON.parse(bannedGroups);
            } catch (e) {
                bannedGroups = [];
            }
        }
        const index = bannedGroups.indexOf(remoteJid);
        if (index === -1) {
            return send(sock, remoteJid, `❌ ${targetName} n'est pas banni(e) de ce groupe`, "warn");
        }
        bannedGroups.splice(index, 1);
        await config.setSetting(`banned_${cleanTarget}`, bannedGroups);
        await send(sock, remoteJid, `✅ ${targetName} a été débanni(e).`, "success");
        try {
            await send(sock, targetJid, `✅ Vous avez été débanni(e) du groupe.`, "success");
        } catch (err) {}
    }
};