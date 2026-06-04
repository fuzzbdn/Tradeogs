const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../supabaseClient');

// Hämtar miljövariablerna från din .env / Vercel
const TRADERA_APP_ID = process.env.TRADERA_APP_ID;
const TRADERA_APP_KEY = process.env.TRADERA_APP_KEY;

// Hjälpfunktion för att läsa cookies (för att veta vem som loggar in)
function getCookie(req, name) {
    if (!req.headers.cookie) return null;
    const value = `; ${req.headers.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

/* =========================================
   1. TRADERA INLOGGNING & CALLBACK
   ========================================= */

// Startar inloggningen mot Tradera
router.get('/login', (req, res) => {
    const { user_id } = req.query;

    if (!TRADERA_APP_ID) {
        return res.status(500).send('Saknar TRADERA_APP_ID i miljövariablerna.');
    }

    // Spara Tradeogs-användarens ID i en cookie så vi vet vem som kopplar kontot
    if (user_id) {
        res.cookie('tradera_user_id', user_id, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            maxAge: 600000 // 10 minuter
        });
    }

    // Skicka användaren till Traderas inloggningssida för att godkänna appen
    const traderaAuthUrl = `https://api.tradera.com/token-login?appId=${TRADERA_APP_ID}`;
    res.redirect(traderaAuthUrl);
});

// Callback-rutten dit Tradera skickar tillbaka användaren efter inloggning
router.get('/callback', async (req, res) => {
    // Tradera skickar med token som en parameter i URL:en
    const { token, userId } = req.query;
    const dbUserId = getCookie(req, 'tradera_user_id');

    if (!token) {
        return res.status(400).send('Fick ingen token tillbaka från Tradera. Har du aktiverat "Display token on return URL" i Traderas utvecklarportal?');
    }
    
    if (!dbUserId) {
        return res.status(400).send('Din Tradeogs-session saknas eller har gått ut. Försök att klicka på knappen i dashboarden igen.');
    }

    try {
        // Ta bort eventuella gamla Tradera-nycklar för användaren
        await supabase.from('plattform_tokens')
            .delete()
            .eq('user_id', dbUserId)
            .eq('plattform', 'tradera');

        // Spara den nya nyckeln
        const { error } = await supabase.from('plattform_tokens').insert({
            user_id: dbUserId,
            plattform: 'tradera',
            access_token: token,
            token_secret: userId || '' // Sparar Tradera-användarens ID om det behövs senare
        });

        if (error) throw error;

        // Rensa cookien och skicka tillbaka användaren till dashboarden
        res.clearCookie('tradera_user_id');
        res.redirect('/dashboard.html');

    } catch (error) {
        console.error('Databasfel:', error.message);
        res.status(500).send('Misslyckades att spara nycklarna från Tradera i databasen.');
    }
});

/* =========================================
   2. HÄMTA AKTIVA ANNONSER
   ========================================= */
router.get('/active-ads', async (req, res) => {
    const { user_id } = req.query;

    if (!TRADERA_APP_ID || !TRADERA_APP_KEY) {
        return res.status(500).json({ error: 'Saknar API-nycklar för Tradera på servern.' });
    }

    if (!user_id) {
        return res.status(401).json({ error: 'Saknar användar-ID för att hämta token.' });
    }

    try {
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
        console.error('Tradera API/Database Fel:', error.message);
        res.status(500).json({ error: 'Kunde inte hämta annonser från Tradera.' });
    }
});

module.exports = router;
