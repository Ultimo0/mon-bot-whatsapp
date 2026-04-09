const { send } = require("../lib/helpers");

module.exports = {
    name: "groupinfo",
    description: "Affiche les informations du groupe",
    public: true,
    groupOnly: true,

    async execute({ sock, remoteJid }) {
        try {
            const metadata = await sock.groupMetadata(remoteJid);
            const participants = metadata.participants || [];
            const normalize = (id) => id?.split("@")[0]?.split(":")[0];
            const getName = async (jid) => {
                try { return await sock.getName(jid); } catch { return normalize(jid); }
            };
            const admins = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
            const adminNames = await Promise.all(admins.slice(0, 5).map(async a => `➤ ${await getName(a.id)}`));
            const ownerName = metadata.owner ? await getName(metadata.owner) : "Inconnu";
            const text = `
╭─────────────────╮
│   🏢 GROUP INFO
╰─────────────────╯

📛 Nom : ${metadata.subject}
👤 Membres : ${participants.length}
👑 Admins : ${admins.length}

📝 Description :
${metadata.desc || "Aucune"}

👑 Owner : ${ownerName}
📢 État : ${metadata.announce ? "🔒 Fermé" : "🔓 Ouvert"}
🛠️ Modif : ${metadata.restrict ? "🔐 Admin" : "✏️ Libre"}

👑 Admins :
${adminNames.length ? adminNames.join("\n") : "Aucun"}
`.trim();
            await send(sock, remoteJid, text, "info");
        } catch (err) {
            console.error(err);
            await send(sock, remoteJid, "⚠️ Erreur chargement groupe", "error");
        }
    }
};