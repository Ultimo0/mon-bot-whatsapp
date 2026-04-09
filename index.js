// ===============================
// 📦 BOT WHATSAPP - CABLO V1.4 (COMPLET AVEC ANTI-LINK)
// ===============================
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const qrcode = require("qrcode-terminal");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const { send, clean } = require("./lib/helpers");

// ===============================
// 🧠 CACHES
// ===============================
const messageCache = new Map();      // pour stocker les clés des messages (anti-spam)
const cooldowns = new Map();         // cooldown des commandes
const COOLDOWN_MS = 2000;
let isReconnecting = false;

// ===============================
// 📦 CHARGEMENT DES COMMANDES
// ===============================
const commands = {};
const commandsPath = path.join(__dirname, "commands");

if (fs.existsSync(commandsPath)) {
    fs.readdirSync(commandsPath).forEach(file => {
        if (!file.endsWith(".js")) return;
        try {
            const cmd = require(`./commands/${file}`);
            if (cmd.name && typeof cmd.execute === "function") {
                commands[cmd.name] = cmd;
            }
        } catch (err) {
            console.error(`❌ Erreur chargement ${file}:`, err);
        }
    });
}
console.log("📦 Commandes chargées :", Object.keys(commands));

// ===============================
// 🧠 FONCTION DE QUESTION
// ===============================
function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

// ===============================
// 🚀 DÉMARRAGE DU BOT
// ===============================
async function startBot(retryCount = 0) {
    if (isReconnecting) return;
    isReconnecting = true;
    console.log("🚀 Démarrage du bot...");

    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();
    console.log("📦 Baileys version:", version);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "info" }),
        browser: ["CABLO BOT", "Chrome", "1.0.0"],
        printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    // ===============================
    // PREMIÈRE CONNEXION (choix QR / pairing)
    // ===============================
    const sessionExists = fs.existsSync("./session") && fs.readdirSync("./session").length > 0;
    if (!sock.authState.creds.registered && !sessionExists) {
        console.log("\n🔐 Aucune session trouvée. Choisissez :");
        console.log("   ➤ 'qr' pour QR code");
        console.log("   ➤ 'pc' pour Pairing Code");
        const method = await ask("👉 Votre choix : ");
        if (method === "pc") {
            const number = await ask("📱 Numéro (ex: 237620471245) : ");
            const code = await sock.requestPairingCode(number);
            console.log(`🔐 Code : ${code.match(/.{1,4}/g).join("-")}`);
            console.log("➡️ WhatsApp > Appareils liés > Lier un appareil");
        } else {
            console.log("📱 QR code généré. Scannez-le :");
            sock.ev.on("connection.update", (up) => { if (up.qr) qrcode.generate(up.qr, { small: true }); });
            await new Promise(r => setTimeout(r, 1000));
        }
    } else if (sessionExists) {
        console.log("🔑 Session existante détectée. Tentative de connexion automatique...");
    }

    // ===============================
    // 📩 TRAITEMENT DES MESSAGES
    // ===============================
    sock.ev.on("messages.upsert", async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg || !msg.message) return;

            const remoteJid = msg.key.remoteJid;
            const isGroup = remoteJid?.endsWith("@g.us") || false;
            const senderJid = msg.key.fromMe ? sock.user.id : (msg.key.participant || msg.key.remoteJid);
            const sender = clean(senderJid);

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            const isCommand = text.startsWith(config.prefix);

            // ===============================
            // 🚫 ANTI-LINK (dans les groupes, messages non-commandes)
            // ===============================
            if (isGroup && !isCommand) {
                const antilinkSettings = await config.getAntilinkSettings(remoteJid);
                if (antilinkSettings.enabled) {
                    // Détection d'URL (simple mais efficace)
                    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/gi;
                    if (urlRegex.test(text)) {
                        const currentWarns = await config.getAntilinkWarnings(remoteJid, sender);
                        const newWarns = await config.addAntilinkWarning(remoteJid, sender);
                        const limit = antilinkSettings.warn_limit;

                        if (newWarns >= limit) {
                            // Expulsion
                            try {
                                await sock.groupParticipantsUpdate(remoteJid, [senderJid], "remove");
                                await send(sock, remoteJid, `🔨 @${sender} a été expulsé pour avoir envoyé trop de liens.`, "error");
                                await config.resetAntilinkWarnings(remoteJid, sender);
                            } catch (err) {
                                await send(sock, remoteJid, "⚠️ Impossible d'expulser (bot admin ?)", "error");
                            }
                        } else {
                            // Avertissement avec message personnalisé
                            let warnMsg = antilinkSettings.warn_message
                                .replace(/{current}/g, newWarns)
                                .replace(/{max}/g, limit);
                            await sock.sendMessage(remoteJid, { text: warnMsg, mentions: [senderJid] });
                        }
                        // Supprimer le message contenant le lien
                        try {
                            await sock.sendMessage(remoteJid, { delete: msg.key });
                        } catch (e) {}
                        return; // Ne pas traiter comme commande
                    }
                }
            }

            // ===============================
            // 🚫 ANTI-SPAM (uniquement messages normaux, pas les commandes)
            // ===============================
            if (isGroup && !isCommand) {
                const antispamEnabled = await config.getSetting("antispam_enabled", true);
                if (antispamEnabled) {
                    const isMuted = await config.isMsgMuted(remoteJid, sender);
                    if (isMuted) return;

                    const now = Date.now();
                    const since = now - 10000;
                    const count = await config.countMsgSpamViolations(remoteJid, sender, since);
                    if (count >= 4) {
                        await config.addMsgSpamViolation(remoteJid, sender, now);
                        const alreadyWarned = await config.hasBeenWarned(remoteJid, sender);
                        const cacheKey = `${remoteJid}|${sender}`;
                        const userMessages = messageCache.get(cacheKey) || [];
                        for (const mk of userMessages.slice(-5)) {
                            try { await sock.sendMessage(remoteJid, { delete: mk }); } catch (e) {}
                        }
                        messageCache.set(cacheKey, []);
                        if (!alreadyWarned) {
                            await send(sock, remoteJid, `⚠️ @${sender} : Pas plus de 4 messages en 10s ! Prochaine fois = expulsion.`, "warn");
                            await config.setWarned(remoteJid, sender);
                        } else {
                            const expulsionKey = `expelled_${remoteJid}_${sender}`;
                            if (!messageCache.has(expulsionKey)) {
                                messageCache.set(expulsionKey, true);
                                try {
                                    await sock.groupParticipantsUpdate(remoteJid, [senderJid], "remove");
                                    await send(sock, remoteJid, `👢 @${sender} expulsé pour spam répété.`, "error");
                                    await config.clearWarned(remoteJid, sender);
                                } catch (err) {
                                    await send(sock, remoteJid, "⚠️ Impossible d'expulser (admin ?). Ignoré 1h.", "error");
                                    await config.addMsgMute(remoteJid, sender, 3600000);
                                }
                            } else if (!(await config.isMsgMuted(remoteJid, sender))) {
                                await config.addMsgMute(remoteJid, sender, 3600000);
                            }
                        }
                        return;
                    }
                    await config.addMsgSpamViolation(remoteJid, sender, Date.now());
                    const cacheKey = `${remoteJid}|${sender}`;
                    if (!messageCache.has(cacheKey)) messageCache.set(cacheKey, []);
                    const msgs = messageCache.get(cacheKey);
                    msgs.push(msg.key);
                    while (msgs.length > 5) msgs.shift();
                    messageCache.set(cacheKey, msgs);
                }
            }

            // ===============================
            // TRAITEMENT DES COMMANDES
            // ===============================
            if (!isCommand) return;

            // Cooldown
            const now = Date.now();
            if (cooldowns.has(sender)) {
                const last = cooldowns.get(sender);
                if (now - last < COOLDOWN_MS) {
                    const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
                    await send(sock, remoteJid, `⏳ Attends ${wait}s avant une autre commande`, "warn");
                    return;
                }
            }
            cooldowns.set(sender, now);

            const args = text.slice(config.prefix.length).trim().split(" ");
            const cmdName = args.shift().toLowerCase();
            const command = commands[cmdName];
            if (!command) return;

            const isOwner = await config.isOwner(sender) || clean(senderJid) === clean(sock.user.id);
            const isWhitelisted = await config.isWhitelisted(sender);
            const privateMode = await config.getSetting("privateMode", true);

            if (privateMode && !isOwner && !isWhitelisted) {
                return send(sock, remoteJid, "🔒 Mode privé", "lock");
            }
            if (command.groupOnly && !isGroup) {
                return send(sock, remoteJid, "❌ Commande groupe uniquement", "warn");
            }
            if (!command.public && !isOwner) {
                return send(sock, remoteJid, "⛔ Commande owner", "error");
            }

            await config.logCommand(sender, cmdName, isGroup ? remoteJid : null);
            try {
                await command.execute({ sock, remoteJid, senderJid, sender, msg, args, isOwner, isGroup, commands });
            } catch (err) {
                console.error("❌ Erreur commande:", err);
                await send(sock, remoteJid, "⚠️ Erreur interne", "error");
            }
        } catch (err) {
            console.error("❌ Erreur globale:", err);
        }
    });

    // ===============================
    // 👋 WELCOME / GOODBYE
    // ===============================
    sock.ev.on("group-participants.update", async (update) => {
        try {
            const { id, participants, action } = update;
            const groupSettings = await config.getGroupSettings(id);
            for (const p of participants) {
                const pid = typeof p === "string" ? p : p?.id;
                if (!pid) continue;
                let name = "quelqu'un";
                try { const raw = await sock.getName(pid); if (raw && !raw.includes("@")) name = raw; } catch (e) {}
                if (action === "add" && groupSettings.welcome_enabled) {
                    let txt = groupSettings.welcome_message.replace(/{name}/g, name);
                    await sock.sendMessage(id, { text: txt, mentions: [pid] });
                }
                if (action === "remove" && groupSettings.goodbye_enabled) {
                    let txt = groupSettings.goodbye_message.replace(/{name}/g, name);
                    await sock.sendMessage(id, { text: txt, mentions: [pid] });
                }
            }
        } catch (err) { console.error("Erreur welcome/goodbye:", err); }
    });

    // ===============================
    // 🚫 ANTI-REJOIN (BAN)
    // ===============================
    sock.ev.on("group-participants.update", async (update) => {
        const { id, participants, action } = update;
        if (action !== "add") return;
        for (const p of participants) {
            const pid = typeof p === "string" ? p : p?.id;
            if (!pid) continue;
            const cleanUser = clean(pid);
            let bannedGroups = await config.getSetting(`banned_${cleanUser}`, []);
            if (!Array.isArray(bannedGroups)) {
                try { bannedGroups = JSON.parse(bannedGroups); } catch(e) { bannedGroups = []; }
            }
            if (bannedGroups.includes(id)) {
                try {
                    await sock.groupParticipantsUpdate(id, [pid], "remove");
                    console.log(`🚫 Banni réexpulsé : ${cleanUser}`);
                    await send(sock, id, `🚫 Un membre banni a tenté de revenir et a été réexpulsé.`, "error");
                } catch (err) { console.error("Erreur anti-rejoin:", err); }
            }
        }
    });

    // ===============================
    // 🔌 GESTION CONNEXION
    // ===============================
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("✅ Bot connecté !");
            isReconnecting = false;
        }
        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Déconnecté, code: ${code}`);
            if (code === DisconnectReason.loggedOut) {
                console.log("🛑 Session expirée. Supprimez 'session' et relancez.");
                isReconnecting = false;
                return;
            }
            const delay = Math.min(30000, 5000 * Math.pow(2, retryCount));
            console.log(`🔄 Reconnexion dans ${delay/1000}s...`);
            setTimeout(() => startBot(retryCount+1), delay);
        }
    });

    // Nettoyage des vieilles violations toutes les heures
    setInterval(async () => {
        const oneHourAgo = Date.now() - 3600000;
        try { await config.clearOldMsgViolations(oneHourAgo); } catch (e) {}
    }, 60 * 60 * 1000);
}

startBot().catch(console.error);