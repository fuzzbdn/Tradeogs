const express = require('express');
const router = express.Router();
const axios = require('axios');

const TRADERA_APP_ID = process.env.TRADERA_APP_ID;
const TRADERA_APP_KEY = process.env.TRADERA_APP_KEY;

// --- STEG 1: SKICKA ANVÄNDAREN TILL TRADERA ---
router.get('/login', (req, res) => {
    const HOST_URL = process.env.HOST_URL || 'http://localhost:3000';
    const redirectUri = `${HOST_URL}/api/tradera/callback`;
    
    // Bygg URL:en till Traderas inloggningssida
    const traderaAuthUrl = `https://api.tradera.com/oauth/authorize?response_type=code&client_id=${TRADERA_APP_ID}&redirect_uri=${redirectUri}&scope=read,write`;
    
    res.redirect(traderaAuthUrl);
});

// --- STEG 2: TRADERA SKICKAR TILLBAKA ANVÄNDAREN HIT ---
router.get('/callback', async (req, res) => {
    const { code } = req.query;
    const HOST_URL = process.env.HOST_URL || 'http://localhost:3000';
    const redirectUri = `${HOST_URL}/api/tradera/callback`;

    if (!code) {
        return res.status(400).send('Ingen auktoriseringskod mottogs från Tradera.');
    }

    try {
        // Byt den tillfälliga koden mot en riktig Access Token
        const response = await axios.post('https://api.tradera.com/oauth/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: TRADERA_APP_ID,
                client_secret: TRADERA_APP_KEY,
                code: code,
                redirect_uri: redirectUri
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Plocka ut nyckeln som ger oss rätt att skapa annonser
        const { access_token } = response.data;

        res.json({
            message: 'Tradera-inloggningen lyckades!',
            tradera_access_token: access_token
        });

    } catch (error) {
        console.error('Tradera Auth Error:', error.response?.data || error.message);
        res.status(500).send('Kunde inte hämta Access Token från Tradera.');
    }
});

module.exports = router;
