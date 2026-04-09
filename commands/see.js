// ===============================
// 📦 COMMANDE : SEE (pour messages à vision unique)
// But : Révéler une photo, vidéo ou audio envoyé(e) en "vu unique"
// Utilisation : répondre au message avec !see
// ===============================

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { send } = require("../lib/helpers");

module.exports = {
    name: "see",
    description: "Affiche un message à vision unique (photo/vidéo/audio) auquel vous répondez",
    public: true,  // accessible à tous (ou restreindre selon vos besoins)

    async execute({ sock, remoteJid, msg, sender, isGroup }) {
        // Vérifier si le message est une réponse
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return send(sock, remoteJid, "📌 Vous devez répondre à un message à vision unique avec !see", "warn");
        }

        // Déterminer le type de média viewOnce
        let mediaMessage = null;
        let type = null;

        // Structure moderne (viewOnceMessageV2)
        const viewOnceV2 = quoted?.viewOnceMessageV2?.message;
        if (viewOnceV2) {
            if (viewOnceV2.imageMessage) {
                mediaMessage = viewOnceV2.imageMessage;
                type = "image";
            } else if (viewOnceV2.videoMessage) {
                mediaMessage = viewOnceV2.videoMessage;
                type = "video";
            } else if (viewOnceV2.audioMessage) {
                mediaMessage = viewOnceV2.audioMessage;
                type = "audio";
            }
        }

        // Structure plus ancienne (viewOnceMessage)
        if (!mediaMessage) {
            const viewOnceOld = quoted?.viewOnceMessage?.message;
            if (viewOnceOld) {
                if (viewOnceOld.imageMessage) {
                    mediaMessage = viewOnceOld.imageMessage;
                    type = "image";
                } else if (viewOnceOld.videoMessage) {
                    mediaMessage = viewOnceOld.videoMessage;
                    type = "video";
                } else if (viewOnceOld.audioMessage) {
                    mediaMessage = viewOnceOld.audioMessage;
                    type = "audio";
                }
            }
        }

        // Fallback : certaines versions placent directement le message sous viewOnce
        if (!mediaMessage) {
            if (quoted?.imageMessage?.viewOnce) {
                mediaMessage = quoted.imageMessage;
                type = "image";
            } else if (quoted?.videoMessage?.viewOnce) {
                mediaMessage = quoted.videoMessage;
                type = "video";
            } else if (quoted?.audioMessage?.viewOnce) {
                mediaMessage = quoted.audioMessage;
                type = "audio";
            }
        }

        if (!mediaMessage) {
            return send(sock, remoteJid, "❌ Ce message n'est pas un vu unique (photo/vidéo/audio).", "error");
        }

        // Télécharger le média
        try {
            const buffer = await downloadMediaMessage(
                { message: quoted },   // le message original
                "buffer",
                { },
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );

            if (!buffer) throw new Error("Téléchargement échoué");

            // Envoyer le média normalement (sans vision unique)
            const caption = "🔓 *Message à vision unique révélé*";
            const sendOptions = { caption, mentions: [sender] };

            if (type === "image") {
                await sock.sendMessage(remoteJid, { image: buffer, ...sendOptions });
            } else if (type === "video") {
                await sock.sendMessage(remoteJid, { video: buffer, ...sendOptions });
            } else if (type === "audio") {
                // Pour l'audio, on l'envoie en tant que fichier audio normal (ptt: false pour ne pas être une note vocale)
                await sock.sendMessage(remoteJid, { audio: buffer, mimetype: "audio/mp4", ptt: false });
                // Optionnel : envoyer un message texte d'accompagnement
                await send(sock, remoteJid, "🔓 Message audio à vision unique révélé", "info");
            }
        } catch (err) {
            console.error("Erreur téléchargement viewOnce:", err);
            await send(sock, remoteJid, "❌ Impossible de télécharger le média. Il est peut-être expiré ou non accessible.", "error");
        }
    }
};