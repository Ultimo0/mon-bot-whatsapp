const { send } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "antilink",
    description: "Configurer l'anti-link du groupe (admin only)",
    groupOnly: true,
    public: false,

    async execute({ sock, remoteJid, args, isOwner, sender }) {
        // Vérifier si l'utilisateur est admin du groupe
        let isAdmin = false;
        try {
            const metadata = await sock.groupMetadata(remoteJid);
            const participants = metadata.participants || [];
            const senderClean = sender.split("@")[0];
            for (const p of participants) {
                if (p.id.split("@")[0] === senderClean && (p.admin === "admin" || p.admin === "superadmin")) {
                    isAdmin = true;
                    break;
                }
            }
        } catch (err) {}
        if (!isAdmin && !isOwner) return send(sock, remoteJid, "⛔ Réservé aux admins", "error");

        const sub = args[0];
        if (!sub) {
            const settings = await config.getAntilinkSettings(remoteJid);
            const status = settings.enabled ? "✅ Activé" : "❌ Désactivé";
            return send(sock, remoteJid, `
📘 *Anti-link* - État : ${status}
Limite d'avertissements : ${settings.warn_limit}
Message : ${settings.warn_message.substring(0, 50)}...

Commandes :
!antilink on/off
!antilink limit <nombre>
!antilink message <votre message avec {current} et {max}>
`, "info");
        }

        if (sub === "on") {
            await config.setAntilinkEnabled(remoteJid, true);
            return send(sock, remoteJid, "✅ Anti-link ACTIVÉ", "success");
        }
        if (sub === "off") {
            await config.setAntilinkEnabled(remoteJid, false);
            return send(sock, remoteJid, "❌ Anti-link DÉSACTIVÉ", "warn");
        }
        if (sub === "limit") {
            const limit = parseInt(args[1]);
            if (isNaN(limit) || limit < 1) return send(sock, remoteJid, "Nombre valide (>=1)", "warn");
            await config.setAntilinkWarnLimit(remoteJid, limit);
            return send(sock, remoteJid, `✅ Limite d'avertissements = ${limit}`, "success");
        }
        if (sub === "message") {
            const msg = args.slice(1).join(" ");
            if (!msg) return send(sock, remoteJid, "Message requis. Utilisez {current} et {max}", "warn");
            await config.setAntilinkWarnMessage(remoteJid, msg);
            return send(sock, remoteJid, "✅ Message personnalisé enregistré", "success");
        }
        return send(sock, remoteJid, "Sous-commande inconnue", "warn");
    }
};