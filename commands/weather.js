const axios = require("axios");
const { send } = require("../lib/helpers");
const config = require("../config");

module.exports = {
    name: "weather",
    description: "Affiche la météo actuelle d'une ville (ex: !weather Paris)",
    public: true,

    async execute({ sock, remoteJid, args }) {
        console.log("🌤️ Commande weather exécutée, args:", args);
        
        if (!args[0]) {
            await send(sock, remoteJid, "🌍 Utilisation : !weather <ville>", "warn");
            return;
        }

        const city = args.join(" ");
        console.log("Recherche météo pour:", city);

        // Vérifier la présence de la clé API
        if (!config.weatherApi || config.weatherApi === "votre_cle_api_ici") {
            console.error("❌ Clé API météo manquante ou invalide dans .env");
            await send(sock, remoteJid, "❌ Service météo non configuré. Contactez l'administrateur.", "error");
            return;
        }

        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${config.weatherApi}&units=metric&lang=fr`;
            console.log("URL appelée:", url.replace(config.weatherApi, "CACHEE"));
            
            const response = await axios.get(url, { timeout: 10000 });
            const data = response.data;
            console.log("Réponse reçue, code:", data.cod);

            const ville = data.name;
            const pays = data.sys.country;
            const temperature = Math.round(data.main.temp);
            const ressenti = Math.round(data.main.feels_like);
            const description = data.weather[0].description;
            const humidite = data.main.humidity;
            const vent = Math.round(data.wind.speed * 3.6);
            const pression = data.main.pressure;

            const message = `
🌍 *${ville}, ${pays}*
🌡️ Température : ${temperature}°C (ressenti ${ressenti}°C)
🌥️ Condition : ${description}
💧 Humidité : ${humidite}%
💨 Vent : ${vent} km/h
📊 Pression : ${pression} hPa
            `.trim();

            await send(sock, remoteJid, message, "info");

        } catch (error) {
            console.error("Erreur météo détaillée:", error.message);
            if (error.response) {
                console.error("Status:", error.response.status, "Data:", error.response.data);
            }
            
            if (error.response?.data?.cod === "404") {
                await send(sock, remoteJid, `❌ Ville "${city}" introuvable. Vérifiez l'orthographe.`, "error");
            } else if (error.response?.data?.cod === "401") {
                await send(sock, remoteJid, "❌ Clé API météo invalide. Contactez l'administrateur.", "error");
            } else if (error.code === "ECONNABORTED") {
                await send(sock, remoteJid, "⏳ Délai dépassé. Réessayez plus tard.", "warn");
            } else {
                await send(sock, remoteJid, "❌ Erreur lors de la récupération de la météo. Réessayez plus tard.", "error");
            }
        }
    }
};