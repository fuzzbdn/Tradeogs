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
            .select('access_token, token_secret')
            .eq('user_id', user_id)
            .eq('plattform', 'tradera')
            .single();

        if (dbError || !tokenRecord) {
            return res.status(404).json({ error: 'Hittade inget kopplat Tradera-konto.' });
        }

        // 1. KORREKT URL FÖR API v4: Hämtar säljarens annonser
        const traderaUrl = 'https://api.tradera.com/v4/listings/seller-items'; 
        
        // 2. UPPDATERADE HEADERS ENLIGT v4-DOKUMENTATIONEN
        const response = await axios.get(traderaUrl, {
            headers: {
                'X-App-Id': TRADERA_APP_ID,
                'X-App-Key': TRADERA_APP_KEY,
                'X-User-Id': tokenRecord.token_secret, // I din inloggningskod sparas userId här
                'X-User-Token': tokenRecord.access_token,   
                'Accept': 'application/json'
            }
        });

        // Beroende på hur pagination fungerar i v4 kan datan ligga direkt i data eller i data.items
        const items = response.data.items || response.data || []; 
        
        // Mappa om resultatet till din frontends struktur.
        // OBS: Namnen på fälten (itemId, price etc.) kan variera något i v4, 
        // logga gärna 'items[0]' i konsolen om rubrik eller pris blir 'undefined'.
        const activeAds = items.map(ad => ({
            id: ad.itemId || ad.id,
            rubrik: ad.shortDescription || ad.title,
            pris: ad.price || ad.currentPrice || 0,
            bud: ad.totalBids || ad.bids || 0,
            slutdatum: ad.endDate
        }));

        res.json({ success: true, annonser: activeAds });

    } catch (error) {
        const status = error.response ? error.response.status : 'Okänd';
        const detaljer = error.response && error.response.data ? JSON.stringify(error.response.data) : error.message;
        
        console.error('Tradera kraschade:', { status, detaljer });
        res.status(500).json({ error: `Tradera vägrade svara! Statuskod: ${status}. Detaljer: ${detaljer}` });
    }
});
// MÅSTE LIGGA LÄNGST NER!
module.exports = router;
