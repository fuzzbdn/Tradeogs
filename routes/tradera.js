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
        // Vi måste hämta BÅDE access_token och token_secret, eftersom Tradera V4 kräver båda
        const { data: tokenRecord, error: dbError } = await supabase
            .from('plattform_tokens')
            .select('access_token, token_secret')
            .eq('user_id', user_id)
            .eq('plattform', 'tradera')
            .single();

        if (dbError || !tokenRecord) {
            return res.status(404).json({ error: 'Hittade inget kopplat Tradera-konto.' });
        }

        const userToken = tokenRecord.access_token;
        const traderaUserId = tokenRecord.token_secret; // Detta är ditt unika ID hos Tradera

        // Den officiella V4-adressen hos Tradera
        const traderaUrl = 'https://api.tradera.com/v4/listings/seller-items'; 
        
        // Tradera V4 kräver specifika X-headers istället för vanliga Bearer tokens
        const response = await axios.get(traderaUrl, {
            headers: {
                'X-App-Id': TRADERA_APP_ID,
                'X-App-Key': TRADERA_APP_KEY,
                'X-User-Id': traderaUserId,
                'X-User-Token': userToken,
                'Accept': 'application/json'
            }
        });

        // Beroende på om Tradera lägger det direkt i en array eller under "items"
        const items = response.data.items || response.data || [];

        // Översätt Traderas data till appens format
        const activeAds = items.map(ad => ({
            id: ad.itemId || ad.id,
            rubrik: ad.shortDescription || ad.title || 'Okänd titel',
            pris: ad.price || ad.buyItNowPrice || ad.currentBid || 0,
            valuta: ad.currency || 'SEK',
            bud: ad.totalBids || ad.bidCount || 0,
            slutdatum: ad.endDate,
            bild_url: ad.imageUrl || (ad.images && ad.images.length > 0 ? ad.images[0].url : '')
        }));

        res.json({ success: true, totalt_annonser: activeAds.length, annonser: activeAds });

    } catch (error) {
        // Behåller skvallerkoden ifall något mer strular
        const status = error.response ? error.response.status : 'Okänd';
        const url = error.config ? error.config.url : 'Okänd URL';
        const data = error.response && error.response.data ? JSON.stringify(error.response.data) : 'Tomt svar';
        
        console.error('Tradera detaljer:', { status, url, data });
        res.status(500).json({ error: `Tradera vägrade svara! Statuskod: ${status}. URL: ${url}. Data: ${data}` });
    }
});

// MÅSTE LIGGA LÄNGST NER!
module.exports = router;
// MÅSTE LIGGA LÄNGST NER!
module.exports = router;
