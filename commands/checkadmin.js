const { send, clean } = require("../lib/helpers");

module.exports = {
    name: "checkadmin",
    groupOnly: true,
    public: false,
    async execute({ sock, remoteJid, isOwner, sender }) {
        const metadata = await sock.groupMetadata(remoteJid);
        const participants = metadata.participants || [];
        
        const botJid = clean(sock.user.id);
        const userJid = clean(sender);
        
        let userIsAdmin = false;
        let botIsAdmin = false;
        
        for (const p of participants) {
            const pClean = clean(p.id);
            if (pClean === userJid && (p.admin === "admin" || p.admin === "superadmin")) userIsAdmin = true;
            if (pClean === botJid && (p.admin === "admin" || p.admin === "superadmin")) botIsAdmin = true;
        }
        
        const result = `📊 État du groupe :
👤 Vous: ${userIsAdmin ? "✅ Admin" : "❌ Non admin"}
🤖 Bot: ${botIsAdmin ? "✅ Admin" : "❌ Non admin"}
🔢 Membres: ${participants.length}`;
        
        await send(sock, remoteJid, result, "info");
    }
};