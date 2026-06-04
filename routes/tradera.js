const express = require('express');
const router = express.Router();
const axios = require('axios');

const TRADERA_APP_ID = process.env.TRADERA_APP_ID;
const TRADERA_APP_KEY = process.env.TRADERA_APP_KEY;

router.get('/active-ads', async (req, res) => {
    // Vi hämtar token från headern eller queryn (beroende på hur du skickar den från frontend)
    const userToken = req.headers.authorization?.split(' ')[1] || req.query.token;

    if (!TRADERA_APP_ID || !TRADERA_APP_KEY) {
        return res.status(500).json({ error: 'Saknar API-nycklar för Tradera på servern.' });
    }

    if (!userToken) {
        return res.status(401).json({ error: 'Saknar användartoken för Tradera.' });
    }

    try {
        const traderaUrl = 'https://api.tradera.com/v3/public/items/active'; 
        
        const response = await axios.get(traderaUrl, {
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'AppId': TRADERA_APP_ID,
                'AppKey': TRADERA_APP_KEY,
                'Accept': 'application/json'
            }
        });

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
        res.status(500).json({ error: 'Kunde inte hämta annonser från Tradera. Kontrollera att din token är giltig.' });
    }
});

module.exports = router;
