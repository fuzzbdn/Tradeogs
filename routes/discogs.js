const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const supabase = require('../supabaseClient'); // Vi behöver Supabase-klienten här nu!

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

// RUTT 1: Synka EN sida från Discogs till Supabase
router.post('/sync-page', async (req, res) => {
    const { token, secret, user_id, page } = req.body;

    if (!token || !secret || !user_id) return res.status(401).json({ error: 'Saknar nycklar eller användar-ID.' });

    const userToken = { key: token, secret: secret };

    try {
        // Hämta användarnamn från Discogs
        const identityUrl = 'https://api.discogs.com/oauth/identity';
        const identityAuthHeader = oauth.toHeader(oauth.authorize({ url: identityUrl, method: 'GET' }, userToken));
        const identityResponse = await axios.get(identityUrl, {
            headers: { 'Authorization': identityAuthHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' }
        });
        const username = identityResponse.data.username;

        // Hämta skivor för den angivna sidan (Vi tar 100 åt gången för att spara tid)
        const collectionUrl = `https://api.discogs.com/users/${username}/collection/folders/0/releases?page=${page}&per_page=100`;
        const collectionAuthHeader = oauth.toHeader(oauth.authorize({ url: collectionUrl, method: 'GET' }, userToken));
        const collectionResponse = await axios.get(collectionUrl, {
            headers: { 'Authorization': collectionAuthHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' }
        });

        const releases = collectionResponse.data.releases;

        // Omformatera datan så den passar vår Supabase-tabell
        const dbRecords = releases.map(item => ({
            user_id: user_id,
            release_id: item.id,
            artist: item.basic_information.artists[0].name,
            titel: item.basic_information.title,
            ar: item.basic_information.year ? item.basic_information.year.toString() : 'Okänt',
            format: item.basic_information.formats ? item.basic_information.formats[0].name : 'Okänt',
            bolag: item.basic_information.labels ? item.basic_information.labels[0].name : 'Okänt',
            katalognummer: item.basic_information.labels ? item.basic_information.labels[0].catno : 'Okänt',
            discogs_url: `https://www.discogs.com/release/${item.id}`,
            bild: item.basic_information.thumb || '',
            genre: item.basic_information.genres ? item.basic_information.genres.join(', ') : 'Okänd genre',
            stil: item.basic_information.styles ? item.basic_information.styles.join(', ') : ''
        }));

        // Upsert betyder "Sätt in ny, eller uppdatera om den redan finns"
        if (dbRecords.length > 0) {
            const { error } = await supabase.from('skivor').upsert(dbRecords, { onConflict: 'user_id, release_id' });
            if (error) throw error;
        }

        res.json({
            message: `Sida ${page} synkad.`,
            pagination: collectionResponse.data.pagination
        });

} catch (error) {
        console.error('Synk Fel:', error);
        
        // Hämta det specifika felmeddelandet (från antingen Supabase eller Discogs)
        const detailedError = error.details || error.message || 'Okänt fel';
        
        res.status(500).json({ error: `Serverfel: ${detailedError}` });
    }
});

// RUTT 2: Hämta skivor blixtsnabbt från vår egen Supabase-databas
router.get('/collection', async (req, res) => {
    const { user_id, page = 1, limit = 25, search = '' } = req.query;

    if (!user_id) return res.status(400).json({ error: 'Saknar användar-ID.' });

    const from = (page - 1) * limit;
    const to = from + parseInt(limit) - 1;

    try {
        let query = supabase
            .from('skivor')
            .select('*', { count: 'exact' })
            .eq('user_id', user_id)
            .order('artist', { ascending: true }) // Alfabetisk sortering direkt i databasen!
            .range(from, to);

        // Om vi har en sökterm, filtrera på artist eller titel
        if (search) {
            query = query.or(`artist.ilike.%${search}%,titel.ilike.%${search}%`);
        }

        const { data, count, error } = await query;
        if (error) throw error;

        const totalPages = Math.ceil(count / limit);

        res.json({
            skivor: data,
            totalt_i_samlingen: count,
            pagination: { pages: totalPages, page: parseInt(page) }
        });

    } catch (error) {
        console.error('Databas Fel:', error.message);
        res.status(500).json({ error: 'Kunde inte hämta samlingen från databasen.' });
    }
});

// RUTT 3: Hämta låtlista OCH prisvärdering från Discogs (Bibehålls som den var)
router.get('/release/:id', async (req, res) => {
    // ... [Samma kod som förut för /release/:id, rör inte denna] ...
    const { token, secret } = req.query;
    const releaseId = req.params.id;

    if (!token || !secret) return res.status(400).json({ error: 'Saknar nycklar.' });
    const userToken = { key: token, secret: secret };

    try {
        const releaseUrl = `https://api.discogs.com/releases/${releaseId}`;
        const releaseAuthHeader = oauth.toHeader(oauth.authorize({ url: releaseUrl, method: 'GET' }, userToken));
        
        const priceUrl = `https://api.discogs.com/marketplace/price_suggestions/${releaseId}`;
        const priceAuthHeader = oauth.toHeader(oauth.authorize({ url: priceUrl, method: 'GET' }, userToken));

        const [releaseRes, priceRes] = await Promise.allSettled([
            axios.get(releaseUrl, { headers: { 'Authorization': releaseAuthHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' } }),
            axios.get(priceUrl, { headers: { 'Authorization': priceAuthHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' } })
        ]);

        const responseData = {};
        if (releaseRes.status === 'fulfilled') responseData.tracklist = releaseRes.value.data.tracklist;
        if (priceRes.status === 'fulfilled') responseData.prices = priceRes.value.data;

        res.json(responseData);
    } catch (error) {
        res.status(500).json({ error: 'Kunde inte hämta release-data.' });
    }
});

module.exports = router;
