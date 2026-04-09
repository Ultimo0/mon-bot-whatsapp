// ===============================
// 📦 COMMANDE : KICKALL
// But : Expulser tous les membres du groupe (sauf le bot et l'admin)
// ===============================

const { send, clean } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "kickall",
    description: "Expulser tous les membres du groupe (admin uniquement)",
    groupOnly: true,
    public: false,

    async execute({ sock, remoteJid, isOwner, sender }) {
        // ===============================
        // 🔐 VÉRIFICATION ADMIN
        // ===============================
        let isAdmin = false;
        let metadata = null;
        try {
            metadata = await sock.groupMetadata(remoteJid);
            const participants = metadata.participants || [];
            const senderClean = clean(sender);
            for (const p of participants) {
                if (clean(p.id) === senderClean && (p.admin === "admin" || p.admin === "superadmin")) {
                    isAdmin = true;
                    break;
                }
            }
        } catch (err) {
            console.error("Erreur vérification admin:", err);
            return send(sock, remoteJid, "❌ Impossible de vérifier vos permissions", "error");
        }

        if (!isAdmin && !isOwner) {
            return send(sock, remoteJid, "⛔ Seuls les admins du groupe peuvent utiliser cette commande", "error");
        }

        // ===============================
        // 📊 RÉCUPÉRATION DES MEMBRES
        // ===============================
        if (!metadata) {
            try {
                metadata = await sock.groupMetadata(remoteJid);
            } catch (err) {
                return send(sock, remoteJid, "❌ Impossible de récupérer la liste des membres", "error");
            }
        }

        const participants = metadata.participants || [];
        const botJid = sock.user.id;
        const botClean = clean(botJid);
        const adminClean = clean(sender);

        // Filtrer : exclure le bot et l'admin qui a lancé la commande
        const toKick = participants.filter(p => {
            const pClean = clean(p.id);
            return pClean !== botClean && pClean !== adminClean;
        });

        if (toKick.length === 0) {
            return send(sock, remoteJid, "👀 Aucun membre à expulser (groupe vide ou seulement vous et le bot)", "info");
        }

        // ===============================
        // 🚪 EXPULSION EN MASSE
        // ===============================
        // WhatsApp limite les expulsions par lot (ex: 20 par requête). On va les envoyer par paquets de 20.
        const batchSize = 20;
        let kicked = 0;
        let failed = 0;

        for (let i = 0; i < toKick.length; i += batchSize) {
            const batch = toKick.slice(i, i + batchSize);
            const jids = batch.map(p => p.id);
            try {
                await sock.groupParticipantsUpdate(remoteJid, jids, "remove");
                kicked += jids.length;
                // Petit délai pour éviter le rate-limiting
                await new Promise(r => setTimeout(r, 2000));
            } catch (err) {
                console.error("Erreur lors de l'expulsion d'un lot:", err);
                failed += jids.length;
            }
        }

        // ===============================
        // 📝 RAPPORT FINAL
        // ===============================
        let message = `🔨 *Kickall terminé* 🔨\n\n✅ Expulsés : ${kicked}\n❌ Échecs : ${failed}`;
        if (failed > 0) {
            message += `\n\n⚠️ Certains membres n'ont pas pu être expulsés (peut-être manque de droits admin ou problème réseau).`;
        }
        await send(sock, remoteJid, message, "info");
    }
};