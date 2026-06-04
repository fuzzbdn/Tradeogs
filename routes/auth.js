const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const supabase = require('../supabaseClient');

function getCookie(req, name) {
    if (!req.headers.cookie) return null;
    const value = `; ${req.headers.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

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

// --- SUPABASE AUTH ---
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        res.json({ message: 'Registrering lyckades!', user: data.user });
    } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        res.json({ message: 'Inloggningen lyckades!', session: data.session, user: data.user });
    } catch (error) { res.status(400).json({ error: error.message }); }
});

router.get('/google', async (req, res) => {
    const HOST_URL = process.env.HOST_URL || 'http://localhost:3000';
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${HOST_URL}/dashboard.html` },
        });
        if (error) throw error;
        res.redirect(data.url);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- DISCOGS AUTH ---
router.get('/discogs/login', async (req, res) => {
    const requestTokenUrl = 'https://api.discogs.com/oauth/request_token';
    const HOST_URL = process.env.HOST_URL || 'http://localhost:3000';
    const { user_id } = req.query;
    
    if (user_id) res.cookie('discogs_user_id', user_id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 600000 });
    
    const requestData = { url: requestTokenUrl, method: 'POST', data: { oauth_callback: `${HOST_URL}/api/auth/discogs/callback` } };

    try {
        const authHeader = oauth.toHeader(oauth.authorize(requestData));
        const response = await axios.post(requestTokenUrl, null, { headers: { 'Authorization': authHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' } });
        const params = new URLSearchParams(response.data);
        res.cookie('discogs_temp_secret', params.get('oauth_token_secret'), { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 600000 });
        res.redirect(`https://www.discogs.com/oauth/authorize?oauth_token=${params.get('oauth_token')}`);
    } catch (error) { res.status(500).send('Kunde inte starta Discogs.'); }
});

router.get('/discogs/callback', async (req, res) => {
    const { oauth_token, oauth_verifier } = req.query;
    const oauth_token_secret = getCookie(req, 'discogs_temp_secret');
    const user_id = getCookie(req, 'discogs_user_id');

    if (!oauth_token || !oauth_verifier || !oauth_token_secret) return res.status(400).send('Session saknas.');

    const accessTokenUrl = 'https://api.discogs.com/oauth/access_token';
    const token = { key: oauth_token, secret: oauth_token_secret };

    try {
        const authHeader = oauth.toHeader(oauth.authorize({ url: accessTokenUrl, method: 'POST', data: { oauth_verifier } }, token));
        const response = await axios.post(accessTokenUrl, null, { headers: { 'Authorization': authHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' } });
        const params = new URLSearchParams(response.data);

        if (user_id) {
            await supabase.from('plattform_tokens').delete().eq('user_id', user_id).eq('plattform', 'discogs');
            await supabase.from('plattform_tokens').insert({ user_id: user_id, plattform: 'discogs', access_token: params.get('oauth_token'), token_secret: params.get('oauth_token_secret') });
        }

        res.clearCookie('discogs_temp_secret'); res.clearCookie('discogs_user_id');
        res.redirect('/dashboard.html');
    } catch (error) { res.status(500).send('Fel vid Access Token.'); }
});

// --- STATUS FÖR KNAPPARNA PÅ DASHBOARDEN ---
router.get('/connections', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Saknar user_id' });

    try {
        const { data, error } = await supabase.from('plattform_tokens').select('plattform').eq('user_id', user_id);
        if (error) throw error;
        
        const connections = {
            discogs: data.some(d => d.plattform === 'discogs'),
            tradera: data.some(d => d.plattform === 'tradera')
        };
        res.json(connections);
    } catch (error) { res.status(500).json({ error: 'Kunde inte kolla anslutningar' }); }
});

// MÅSTE LIGGA LÄNGST NER!
module.exports = router;
