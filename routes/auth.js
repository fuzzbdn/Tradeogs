const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const supabase = require('../supabaseClient');

// Hjälpfunktion för att läsa cookies
function getCookie(req, name) {
    if (!req.headers.cookie) return null;
    const value = `; ${req.headers.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Konfigurera OAuth 1.0a för Discogs
const oauth = OAuth({
    consumer: { 
        key: process.env.DISCOGS_CONSUMER_KEY, 
        secret: process.env.DISCOGS_CONSUMER_SECRET 
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    },
});

// Enkel test-rutt
router.get('/test', async (req, res) => {
    res.json({ message: 'Auth-systemet är inkopplat och redo för Discogs!' });
});

// --- STEG 1: SKICKA ANVÄNDAREN TILL DISCOGS ---
router.get('/discogs/login', async (req, res) => {
    const requestTokenUrl = 'https://api.discogs.com/oauth/request_token';
    const HOST_URL = process.env.HOST_URL || 'http://localhost:3000';
    
    const requestData = {
        url: requestTokenUrl,
        method: 'POST',
        data: { oauth_callback: `${HOST_URL}/api/auth/discogs/callback` }
    };

    try {
        const authHeader = oauth.toHeader(oauth.authorize(requestData));
        const response = await axios.post(requestTokenUrl, null, {
            headers: { 
                'Authorization': authHeader['Authorization'],
                'User-Agent': 'Tradeogs/1.0'
            }
        });

        const params = new URLSearchParams(response.data);
        const oauth_token = params.get('oauth_token');
        const oauth_token_secret = params.get('oauth_token_secret');

        // Spara den tillfälliga hemligheten i en cookie i 10 minuter
        res.cookie('discogs_temp_secret', oauth_token_secret, { httpOnly: true, secure: true, maxAge: 600000 });

        // Skicka användaren vidare till Discogs godkännande-sida
        res.redirect(`https://www.discogs.com/oauth/authorize?oauth_token=${oauth_token}`);

    } catch (error) {
        console.error('Fel vid Request Token:', error.message);
        res.status(500).send('Kunde inte starta inloggningen mot Discogs.');
    }
});

// --- STEG 2: DISCOGS SKICKAR TILLBAKA ANVÄNDAREN HIT ---
router.get('/discogs/callback', async (req, res) => {
    const { oauth_token, oauth_verifier } = req.query;
    const oauth_token_secret = getCookie(req, 'discogs_temp_secret');

    // Kontrollera så att vi har alla tre delar som krävs
    if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
        return res.status(400).send('Något gick fel, sessionen saknas eller har gått ut. Försök igen.');
    }

    const accessTokenUrl = 'https://api.discogs.com/oauth/access_token';
    const requestData = {
        url: accessTokenUrl,
        method: 'POST',
        data: { oauth_verifier }
    };

    const token = {
        key: oauth_token,
        secret: oauth_token_secret
    };

    try {
        const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
        const response = await axios.post(accessTokenUrl, null, {
            headers: { 
                'Authorization': authHeader['Authorization'],
                'User-Agent': 'Tradeogs/1.0'
            }
        });

        // Nu får vi de slutgiltiga nycklarna!
        const params = new URLSearchParams(response.data);
        const final_token = params.get('oauth_token');
        const final_secret = params.get('oauth_token_secret');

        // För att testa att det fungerar dumpar vi resultatet på skärmen (senare sparar vi det i Supabase)
        res.json({
            message: 'Inloggningen lyckades!',
            discogs_token: final_token,
            discogs_secret: final_secret
        });

    } catch (error) {
        console.error('Fel vid Access Token:', error.message);
        res.status(500).send('Misslyckades att hämta de slutgiltiga nycklarna från Discogs.');
    }
});

module.exports = router;
