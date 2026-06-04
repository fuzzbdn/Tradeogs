const express = require('express');
const router = express.Router();
const axios = require('axios');

// Traderas API-nycklar (dessa bör ligga i din .env-fil)
const TRADERA_APP_ID = process.env.TRADERA_APP_ID;
const TRADERA_APP_KEY = process.env.TRADERA_APP_KEY;

// RUTT: Hämta användarens aktiva annonser från Tradera
router.get('/active-ads', async (req, res) => {
    // Om du använder OAuth/användarspecifika tokens för Tradera kommer de från frontend
    const { userToken } = req.query; 

    if (!TRADERA_APP_ID || !TRADERA_APP_KEY) {
        return res.status(500).json({ error: 'Saknar API-nycklar för Tradera på servern.' });
    }

    try {
        // Observera: Detta är en generell struktur för Traderas REST API.
        // Beroende på vilken version av deras API du fått tillgång till 
        // kan URL:en och headersen behöva justeras något.
        const traderaUrl = 'https://api.tradera.com/v3/public/items/active'; 
        
        const response = await axios.get(traderaUrl, {
            headers: {
                'Authorization': `Bearer ${userToken}`, // Om det krävs för personlig data
                'AppId': TRADERA_APP_ID,
                'AppKey': TRADERA_APP_KEY,
                'Accept': 'application/json'
            }
        });

        // Formatera om datan så den blir lätt att använda i frontend
        const activeAds = response.data.items.map(ad => ({
            id: ad.itemId,
            rubrik: ad.shortDescription,
            pris: ad.price,
            valuta: ad.currency,
            bud: ad.totalBids,
            slutdatum: ad.endDate,
            bild_url: ad.imageUrl
        }));

        res.json({
            success: true,
            totalt_annonser: activeAds.length,
            annonser: activeAds
        });

    } catch (error) {
        console.error('Tradera API Fel:', error.response?.data || error.message);
        res.status(500).json({ error: 'Kunde inte hämta annonser från Tradera.' });
    }
});

module.exports = router;
