const express = require('express');
const router = express.Router();

const TRADERA_APP_ID = process.env.TRADERA_APP_ID;
const TRADERA_APP_KEY = process.env.TRADERA_APP_KEY; 

// --- STEG 1: SKICKA ANVÄNDAREN TILL TRADERA ---
router.get('/login', (req, res) => {
    // Traderas egna inloggningssida kräver AppId och AppKey (som de kallar pkey)
    const traderaAuthUrl = `https://api.tradera.com/token-login?appId=${TRADERA_APP_ID}&pkey=${TRADERA_APP_KEY}`;
    
    res.redirect(traderaAuthUrl);
});

// --- STEG 2: TRADERA SKICKAR TILLBAKA ANVÄNDAREN HIT ---
router.get('/callback', (req, res) => {
    // Tradera skickar tillbaka den färdiga nyckeln direkt i webbadressen!
    const { token, userId, exp } = req.query;

    if (!token) {
        return res.status(400).send('Ingen auktorisering mottogs från Tradera. Har du fyllt i rätt Accept URL i Tradera-portalen?');
    }

    res.json({
        message: 'Tradera-inloggningen lyckades!',
        tradera_token: token,
        tradera_user_id: userId,
        expires: exp
    });
});

module.exports = router;
