// ===============================
// 📦 COMMANDE : MENU (image + texte fusionnés, puis audio)
// ===============================
const fs = require("fs");
const path = require("path");
const { menu } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "menu",
    description: "Affiche le menu avec image intégrée (légende) + audio",
    public: true,

    async execute({ sock, remoteJid, commands, isOwner }) {
        const imagePath = path.join(__dirname, "..", "assets", "menu.jpg");
        const audioPath = path.join(__dirname, "..", "assets", "menu.ogg");

        // Génération du texte du menu
        const textMenu = menu(commands, config.prefix, isOwner);

        // 1️⃣ Envoi de l'image AVEC le texte en légende (si image existe)
        if (fs.existsSync(imagePath)) {
            try {
                const imageBuffer = fs.readFileSync(imagePath);
                await sock.sendMessage(remoteJid, {
                    image: imageBuffer,
                    caption: textMenu   // Le menu devient la légende de l'image
                });
            } catch (err) {
                console.error("Erreur envoi image menu:", err);
                // Fallback : envoyer seulement le texte si l'image échoue
                await sock.sendMessage(remoteJid, { text: textMenu });
            }
        } else {
            // Si pas d'image, envoyer seulement le texte
            await sock.sendMessage(remoteJid, { text: textMenu });
            console.log("⚠️ Image menu introuvable :", imagePath);
        }

        // 2️⃣ Envoi de l'audio (si existant) APRÈS l'image
        if (fs.existsSync(audioPath)) {
            try {
                const audioBuffer = fs.readFileSync(audioPath);
                await sock.sendMessage(remoteJid, {
                    audio: audioBuffer,
                    mimetype: 'audio/ogg; codecs=opus', // 👈 Mime-type exact pour Opus
                    ptt: true
                });
            } catch (err) {
                console.error("Erreur envoi audio menu:", err);
            }
        } else {
            console.log("⚠️ Audio menu introuvable :", audioPath);
        }
    }
};