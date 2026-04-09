// ===============================
// 📦 HELPERS (send, menu, clean)
// ===============================
const BOT_NAME = "*ULTIM✪*";

function getTime() {
    return new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

// 🔥 Nettoie un JID : enlève @s.whatsapp.net, @lid, :, etc.
function clean(id) {
    if (!id) return "";
    return id.split("@")[0].split(":")[0];
}

function format(text, type = "info") {
    const styles = {
        info: "📢",
        success: "✅",
        error: "❌",
        warn: "⚠️",
        lock: "🔒",
        owner: "👑"
    };
    const emoji = styles[type] || "📢";
    return `
╔═══════════════════⬣
│ 🤖 ${BOT_NAME}
│
│ ${emoji} ${text}
│
│ 🕒 ${getTime()}
╚═══════════════════⬣
`.trim();
}

async function send(sock, jid, text, type = "info") {
    try {
        await sock.sendMessage(jid, { text: format(text, type) });
    } catch (err) {
        console.error(`❌ Échec d'envoi à ${jid}:`, err.message);
    }
}

function menu(commands, prefix, isOwner = false) {
    let publicCmds = [];
    let ownerCmds = [];
    let groupCmds = [];

    for (const cmdName in commands) {
        const cmd = commands[cmdName];
        if (cmd.groupOnly) groupCmds.push(cmdName);
        if (cmd.public !== false) publicCmds.push(cmdName);
        else ownerCmds.push(cmdName);
    }

    // Tri alphabétique pour plus de clarté
    publicCmds.sort();
    groupCmds.sort();
    ownerCmds.sort();

    const lines = [];
    lines.push("╭──────────────────╮");
    lines.push("│     *🤖 ULTIM✪ BOT*     │");
    lines.push("│    ━ MENU PRINCIPAL ━ │");
    lines.push("├──────────────────┤");
    lines.push("│ 📌 Commandes publiques│");
    if (publicCmds.length) {
        for (const cmd of publicCmds) {
            lines.push(`│   ➤ ${prefix}${cmd}`);
        }
    } else {
        lines.push("│   Aucune");
    }
    lines.push("├──────────────────┤");
    lines.push("│ 👥 Commandes groupe   │");
    if (groupCmds.length) {
        for (const cmd of groupCmds) {
            lines.push(`│   ➤ ${prefix}${cmd}`);
        }
    } else {
        lines.push("│   Aucune");
    }
    lines.push("├──────────────────┤");
    lines.push("│ 👑 Commandes owner    │");
    if (isOwner) {
        if (ownerCmds.length) {
            for (const cmd of ownerCmds) {
                lines.push(`│   ➤ ${prefix}${cmd}`);
            }
        } else {
            lines.push("│   Aucune");
        }
    } else {
        lines.push("│   🔒 Réservé propriétaire");
    }
    lines.push("├──────────────────┤");
    lines.push(`│ 🕒 ${getTime()}       │`);
    lines.push("╰──────────────────╯");

    return lines.join("\n");
}

module.exports = {
    send,
    menu,
    clean,
    getTime
};