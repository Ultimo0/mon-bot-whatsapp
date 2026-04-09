// ===============================
// 📦 COMMANDE : GOODBYE
// But : Activer/désactiver et personnaliser le message de départ dans un groupe
// ===============================

const { send } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "goodbye",
    description: "Active/désactive le message de départ pour ce groupe (admin uniquement)",
    groupOnly: true,
    public: false,  // Réservé aux admins du groupe ou propriétaire

    async execute({ sock, remoteJid, args, isOwner, sender }) {
        // ===============================
        // 🔐 VÉRIFICATION DES PERMISSIONS
        // ===============================
        let isUserAdmin = false;
        try {
            const metadata = await sock.groupMetadata(remoteJid);
            const participants = metadata.participants || [];
            const senderClean = sender.split("@")[0];
            for (const p of participants) {
                const pClean = p.id.split("@")[0];
                if (pClean === senderClean && (p.admin === "admin" || p.admin === "superadmin")) {
                    isUserAdmin = true;
                    break;
                }
            }
        } catch (err) {
            console.error("Erreur vérification admin goodbye:", err);
            return send(sock, remoteJid, "❌ Impossible de vérifier vos permissions", "error");
        }

        if (!isUserAdmin && !isOwner) {
            return send(sock, remoteJid, "⛔ Seuls les admins du groupe peuvent configurer le message de départ", "error");
        }

        // ===============================
        // 📝 TRAITEMENT DES SOUS-COMMANDES
        // ===============================
        const option = args[0];

        // 🟢 ACTIVER
        if (option === "on") {
            await config.setGroupGoodbye(remoteJid, true);
            return send(sock, remoteJid, "👋 Message de départ ACTIVÉ pour ce groupe", "success");
        }

        // 🔴 DÉSACTIVER
        if (option === "off") {
            await config.setGroupGoodbye(remoteJid, false);
            return send(sock, remoteJid, "🔇 Message de départ DÉSACTIVÉ", "warn");
        }

        // 📝 PERSONNALISER LE MESSAGE
        if (option === "set") {
            const newMessage = args.slice(1).join(" ");
            if (!newMessage) {
                return send(sock, remoteJid, "⚠️ Utilisation : !goodbye set Votre message avec {name}", "warn");
            }
            // Activer automatiquement si ce n'était pas déjà fait
            const settings = await config.getGroupSettings(remoteJid);
            if (!settings.goodbye_enabled) {
                await config.setGroupGoodbye(remoteJid, true);
            }
            await config.setGroupGoodbye(remoteJid, true, newMessage);
            return send(sock, remoteJid, `📝 Message de départ mis à jour :\n${newMessage}`, "info");
        }

        // 🔄 RÉINITIALISER LE MESSAGE PAR DÉFAUT
        if (option === "reset") {
            const defaultMessage = "{name} a quitté le groupe. Au revoir ! 👋";
            await config.setGroupGoodbye(remoteJid, true, defaultMessage);
            return send(sock, remoteJid, "🔄 Message de départ réinitialisé au texte par défaut", "success");
        }

        // 📊 AFFICHER LE STATUT
        if (option === "status") {
            const settings = await config.getGroupSettings(remoteJid);
            const status = settings.goodbye_enabled ? "✅ Activé" : "❌ Désactivé";
            const msg = settings.goodbye_message || "{name} a quitté le groupe. Au revoir ! 👋";
            return send(sock, remoteJid, `📊 *Message de départ*\nStatut : ${status}\nMessage :\n${msg}`, "info");
        }

        // ❓ AIDE
        return send(sock, remoteJid, `
📘 *Commandes goodbye :*

➤ !goodbye on        - Activer le message de départ
➤ !goodbye off       - Désactiver
➤ !goodbye set {message} - Personnaliser (utilisez {name})
➤ !goodbye reset     - Revenir au message par défaut
➤ !goodbye status    - Voir l'état actuel
`, "info");
    }
};