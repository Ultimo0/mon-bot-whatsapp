const { send, clean } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "ban",
    description: "Bannir un membre du groupe (admin uniquement)",
    groupOnly: true,
    public: false,

    async execute({ sock, remoteJid, msg, args, isOwner, sender }) {
        // Vérifier si l'utilisateur est admin du groupe
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
            console.error("Erreur vérification admin:", err);
            return send(sock, remoteJid, "❌ Impossible de vérifier les permissions", "error");
        }
        if (!isUserAdmin && !isOwner) {
            return send(sock, remoteJid, "⛔ Seuls les admins du groupe peuvent bannir", "error");
        }

        // Récupération de la cible
        let targetJid = null;
        let targetName = "ce membre";

        if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            targetJid = msg.message.extendedTextMessage.contextInfo.participant;
        } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (args[0]) {
            let arg = args[0].replace(/[^0-9]/g, "");
            if (arg.length >= 10) targetJid = arg + "@s.whatsapp.net";
        }

        if (!targetJid) {
            return send(sock, remoteJid, "📘 Utilisation : !ban @utilisateur (ou répondez à son message)", "warn");
        }

        const cleanTarget = clean(targetJid);
        const cleanSender = clean(sender);
        const cleanBot = clean(sock.user.id);

        if (cleanTarget === cleanSender && !isOwner) {
            return send(sock, remoteJid, "❌ Vous ne pouvez pas vous bannir vous-même", "error");
        }
        if (cleanTarget === cleanBot) {
            return send(sock, remoteJid, "❌ Vous ne pouvez pas bannir le bot", "error");
        }

        // Récupérer le nom
        try {
            const contact = await sock.getName(targetJid);
            if (contact && !contact.includes("@")) targetName = contact;
            else targetName = cleanTarget;
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
        if (!bannedGroups.includes(remoteJid)) {
            bannedGroups.push(remoteJid);
            await config.setSetting(`banned_${cleanTarget}`, bannedGroups);
        }

        // Expulsion
        try {
            await sock.groupParticipantsUpdate(remoteJid, [targetJid], "remove");
            await send(sock, remoteJid, `🔨 ${targetName} a été banni(e) du groupe !`, "error");
            try {
                await send(sock, targetJid, `🔨 Vous avez été banni(e) du groupe.`, "error");
            } catch (err) {}
        } catch (err) {
            console.error("Erreur bannissement:", err);
            await send(sock, remoteJid, "❌ Impossible de bannir. Vérifiez que le bot est admin.", "error");
        }
    }
};