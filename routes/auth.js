const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const supabase = require('../supabaseClient');

// Hjälpfunktion för att läsa cookies (används av Discogs)
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


// ==========================================
// 1. SUPABASE AUTH (Skapa konto & Logga in)
// ==========================================

// Skapa konto med e-post och lösenord
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Du måste ange både e-post och lösenord.' });
    }
    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        res.json({ message: 'Registrering lyckades! Kontrollera din e-post.', user: data.user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Logga in med e-post och lösenord
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Du måste ange både e-post och lösenord.' });
    }
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        res.json({ message: 'Inloggningen lyckades!', session: data.session, user: data.user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Starta Google OAuth
router.get('/google', async (req, res) => {
    const HOST_URL = process.env.HOST_URL || 'http://localhost:3000';
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { 
                redirectTo: `${HOST_URL}/dashboard.html` 
            },
        });
        if (error) throw error;
        res.redirect(data.url);
    } catch (error) {
        res.status(500).json({ error: 'Kunde inte starta Google-inloggning: ' + error.message });
    }
});


// ==========================================
// 2. DISCOGS AUTH (OAuth 1.0a)
// ==========================================

// Rutt för att initiera Discogs-inloggning
router.get('/discogs/login', async (req, res) => {
    const requestTokenUrl = 'https://api.discogs.com/oauth/request_token';
    const HOST_URL = process.env.HOST_URL || 'http://localhost:3000';
    
    // NYTT: Fånga upp user_id från frontend och spara i en cookie så vi vet vem som loggar in
    const { user_id } = req.query;
    if (user_id) {
        // secure: true rekommenderas om du kör HTTPS (t.ex. på Vercel)
        res.cookie('discogs_user_id', user_id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 600000 });
    }
    
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

        res.cookie('discogs_temp_secret', oauth_token_secret, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 600000 });
        res.redirect(`https://www.discogs.com/oauth/authorize?oauth_token=${oauth_token}`);

    } catch (error) {
        console.error('Fel vid Request Token:', error.message);
        res.status(500).send('Kunde inte starta inloggningen mot Discogs.');
    }
});

// Callback-rutt från Discogs efter godkänd auktorisering
router.get('/discogs/callback', async (req, res) => {
    const { oauth_token, oauth_verifier } = req.query;
    const oauth_token_secret = getCookie(req, 'discogs_temp_secret');
    const user_id = getCookie(req, 'discogs_user_id'); // NYTT: Hämta användarens ID från cookien

    if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
        return res.status(400).send('Något gick fel, sessionen saknas eller har gått ut. Försök igen.');
    }

    const accessTokenUrl = 'https://api.discogs.com/oauth/access_token';
    const requestData = { url: accessTokenUrl, method: 'POST', data: { oauth_verifier } };
    const token = { key: oauth_token, secret: oauth_token_secret };

    try {
        const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
        const response = await axios.post(accessTokenUrl, null, {
            headers: { 
                'Authorization': authHeader['Authorization'],
                'User-Agent': 'Tradeogs/1.0'
            }
        });

        const params = new URLSearchParams(response.data);
        const final_token = params.get('oauth_token');
        const final_secret = params.get('oauth_token_secret');

        // NYTT: Spara tokens direkt i Supabase databas istället för att skicka till frontend
        if (user_id) {
            // Rensa eventuella gamla nycklar för denna användare och plattform
            await supabase.from('plattform_tokens')
                .delete()
                .eq('user_id', user_id)
                .eq('plattform', 'discogs');

            // Lägg in de nya
            const { error } = await supabase.from('plattform_tokens').insert({
                user_id: user_id,
                plattform: 'discogs',
                access_token: final_token,
                token_secret: final_secret // Se till att du har denna kolumn i din tabell (eller kalla den refresh_token om du återanvänder det fältet)
            });
            
            if (error) {
                console.error('Databasfel vid sparande av Discogs-tokens:', error);
            }
        }

        // Rensa de tillfälliga cookies som användes för flödet
        res.clearCookie('discogs_temp_secret');
        res.clearCookie('discogs_user_id');

        // Skicka tillbaka användaren till dashboarden (utan att exponera secret i URL:en)
        res.redirect('/dashboard.html');

    } catch (error) {
        console.error('Fel vid Access Token:', error.message);
        res.status(500).send('Misslyckades att hämta de slutgiltiga nycklarna från Discogs.');
    }
});

module.exports = router;
