// ===============================
// 📦 COMMANDE : KICK (sans vérification admin)
// ===============================

const { send, clean } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "kick",
    description: "Expulser un membre du groupe (admin uniquement)",
    groupOnly: true,
    public: false,

    async execute({ sock, remoteJid, msg, args, isOwner, sender }) {
        // ===============================
        // 🔐 VÉRIFICATION ADMIN UTILISATEUR (obligatoire)
        // ===============================
        let isUserAdmin = false;
        let metadata = null;
        
        try {
            metadata = await sock.groupMetadata(remoteJid);
            const participants = metadata.participants || [];
            const userClean = clean(sender);
            
            for (const p of participants) {
                if (clean(p.id) === userClean && (p.admin === "admin" || p.admin === "superadmin")) {
                    isUserAdmin = true;
                    break;
                }
            }
        } catch (err) {
            console.error("Erreur vérification:", err);
            return send(sock, remoteJid, "❌ Impossible de vérifier vos permissions", "error");
        }

        if (!isUserAdmin && !isOwner) {
            return send(sock, remoteJid, "⛔ Seuls les admins du groupe peuvent expulser des membres", "error");
        }

        // ===============================
        // 🎯 RÉCUPÉRATION DE LA CIBLE
        // ===============================
        let targetJid = null;
        let targetName = "ce membre";

        // Cas 1 : En répondant à un message
        if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            targetJid = msg.message.extendedTextMessage.contextInfo.participant;
        }
        // Cas 2 : Mention explicite
        else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        // Cas 3 : Numéro passé en argument
        else if (args[0]) {
            let arg = args[0].replace(/[^0-9]/g, "");
            if (arg.length >= 10) {
                targetJid = arg + "@s.whatsapp.net";
            }
        }

        if (!targetJid) {
            return send(sock, remoteJid, "📘 Utilisation : !kick @utilisateur (ou répondez à son message)", "warn");
        }

        const cleanTarget = clean(targetJid);
        const cleanSender = clean(sender);
        const cleanBot = clean(sock.user.id);

        // Empêcher l'auto-kick
        if (cleanTarget === cleanSender && !isOwner) {
            return send(sock, remoteJid, "❌ Vous ne pouvez pas vous expulser vous-même", "error");
        }

        // Empêcher de kick le bot
        if (cleanTarget === cleanBot) {
            return send(sock, remoteJid, "❌ Vous ne pouvez pas expulser le bot", "error");
        }

        // Récupérer le nom
        try {
            const contact = await sock.getName(targetJid);
            if (contact && !contact.includes("@")) targetName = contact;
            else targetName = cleanTarget;
        } catch (err) {}

        // ===============================
        // 🚪 EXPULSION (sans vérifier si le bot est admin)
        // ===============================
        try {
            await sock.groupParticipantsUpdate(remoteJid, [targetJid], "remove");
            await send(sock, remoteJid, `👢 ${targetName} a été expulsé(e) du groupe !`, "success");
            
            // Message privé optionnel
            try {
                await send(sock, targetJid, `👢 Vous avez été expulsé(e) du groupe.`, "warn");
            } catch (err) {}
            
        } catch (err) {
            console.error("Erreur expulsion:", err);
            
            if (err.message?.includes("not a participant")) {
                await send(sock, remoteJid, "❌ Cette personne n'est plus dans le groupe", "error");
            } else {
                await send(sock, remoteJid, "❌ Impossible d'expulser. Vérifiez que le bot est bien admin dans WhatsApp.", "error");
            }
        }
    }
};