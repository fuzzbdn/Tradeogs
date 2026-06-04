const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../supabaseClient');

// Hämtar miljövariablerna från din .env-fil / Vercel
const TRADERA_APP_ID = process.env.TRADERA_APP_ID;
const TRADERA_APP_KEY = process.env.TRADERA_APP_KEY;

/* =========================================
   HÄMTA AKTIVA ANNONSER
   ========================================= */
router.get('/active-ads', async (req, res) => {
    // Vi hämtar user_id som skickades med från frontendens app.js
    const { user_id } = req.query;

    if (!TRADERA_APP_ID || !TRADERA_APP_KEY) {
        return res.status(500).json({ error: 'Saknar API-nycklar för Tradera på servern.' });
    }

    if (!user_id) {
        return res.status(401).json({ error: 'Saknar användar-ID för att hämta token.' });
    }

    try {
        // 1. Hämta token från databasen istället för från webbläsaren
        const { data: tokenRecord, error: dbError } = await supabase
            .from('plattform_tokens')
            .select('access_token')
            .eq('user_id', user_id)
            .eq('plattform', 'tradera')
            .single();

        if (dbError || !tokenRecord) {
            return res.status(404).json({ error: 'Hittade inget kopplat Tradera-konto för denna användare.' });
        }

        const userToken = tokenRecord.access_token;
        
        // 2. Anropa Traderas API
        const traderaUrl = 'https://api.tradera.com/v3/public/items/active'; 
        
        const response = await axios.get(traderaUrl, {
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'AppId': TRADERA_APP_ID,
                'AppKey': TRADERA_APP_KEY,
                'Accept': 'application/json'
            }
        });

        // 3. Formatera datan för frontenden
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
        console.error('Tradera API/Database Fel:', error.message);
        res.status(500).json({ error: 'Kunde inte hämta annonser från Tradera.' });
    }
});

// Här lägger vi in inloggningsflödet (login/callback) för Tradera när du är redo 
// att bygga det flödet, så att token sparas i plattform_tokens.

module.exports = router;
