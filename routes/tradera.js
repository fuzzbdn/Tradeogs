const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../supabaseClient');

const TRADERA_APP_ID = process.env.TRADERA_APP_ID;
const TRADERA_APP_KEY = process.env.TRADERA_APP_KEY;

function getCookie(req, name) {
    if (!req.headers.cookie) return null;
    const value = `; ${req.headers.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
} 

// 1. INLOGGNING TRADERA
router.get('/login', (req, res) => {
    const { user_id } = req.query;

    if (!TRADERA_APP_ID || !TRADERA_APP_KEY) {
        return res.status(500).send('Saknar TRADERA_APP_ID eller TRADERA_APP_KEY i miljövariablerna.');
    }

    if (user_id) {
        res.cookie('tradera_user_id', user_id, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            maxAge: 600000 
        });
    }

const traderaAuthUrl = `https://api.tradera.com/token-login?appId=${TRADERA_APP_ID}&pkey=${TRADERA_APP_KEY}`;    res.redirect(traderaAuthUrl);
});

// 2. CALLBACK FRÅN TRADERA
router.get('/callback', async (req, res) => {
    const { token, userId } = req.query;
    const dbUserId = getCookie(req, 'tradera_user_id');

    if (!token) return res.status(400).send('Fick ingen token tillbaka från Tradera.');
    if (!dbUserId) return res.status(400).send('Din Tradeogs-session saknas eller har gått ut.');

    try {
        await supabase.from('plattform_tokens').delete()
            .eq('user_id', dbUserId)
            .eq('plattform', 'tradera');

        const { error } = await supabase.from('plattform_tokens').insert({
            user_id: dbUserId,
            plattform: 'tradera',
            access_token: token,
            token_secret: userId || ''
        });

        if (error) throw error;

        res.clearCookie('tradera_user_id');
        res.redirect('/dashboard.html');

    } catch (error) {
        console.error('Databasfel:', error.message);
        res.status(500).send('Misslyckades att spara nycklarna från Tradera.');
    }
});

// 3. HÄMTA AKTIVA ANNONSER
router.get('/active-ads', async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) return res.status(401).json({ error: 'Saknar användar-ID.' });

    try {
        const { data: tokenRecord, error: dbError } = await supabase
            .from('plattform_tokens')
            .select('access_token, token_secret') // token_secret innehåller userId från Tradera
            .eq('user_id', user_id)
            .eq('plattform', 'tradera')
            .single();

        if (dbError || !tokenRecord) {
            return res.status(404).json({ error: 'Hittade inget kopplat Tradera-konto.' });
        }

        // Enligt dokumentationen: Använd AppId, AppKey, UserId och Token
        const traderaUrl = 'https://api.tradera.com/v3/public/items/active'; 
        
        const response = await axios.get(traderaUrl, {
            headers: {
                'AppId': TRADERA_APP_ID,
                'AppKey': TRADERA_APP_KEY,
                'UserId': tokenRecord.token_secret, // Dokumentationen anger UserId
                'Token': tokenRecord.access_token,   // Dokumentationen anger Token
                'Accept': 'application/json'
            }
        });

        // Resten av din kod för att mappa annonser förblir densamma...
        const items = response.data.items || [];
        const activeAds = items.map(ad => ({
            id: ad.itemId,
            rubrik: ad.shortDescription,
            pris: ad.price,
            bud: ad.totalBids,
            slutdatum: ad.endDate
        }));

        res.json({ success: true, annonser: activeAds });

    } catch (error) {
        // ... din felhantering här
    }
});
// MÅSTE LIGGA LÄNGST NER!
module.exports = router;
