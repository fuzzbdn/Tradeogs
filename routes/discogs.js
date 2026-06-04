const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const supabase = require('../supabaseClient');

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

/* =========================================================================
   RUTT 1: Synka EN sida från Discogs till Supabase (Säker version via DB)
   ========================================================================= */
router.post('/sync-page', async (req, res) => {
    // Vi hämtar nu enbart user_id och page från frontend
    const { user_id, page } = req.body;

    if (!user_id) return res.status(400).json({ error: 'Saknar användar-ID.' });
    if (!page) return res.status(400).json({ error: 'Saknar sidnummer.' });

    try {
        // 1. Hämta Discogs-tokens från databasen för denna användare
        const { data: tokenRecord, error: dbError } = await supabase
            .from('plattform_tokens')
            .select('access_token, token_secret')
            .eq('user_id', user_id)
            .eq('plattform', 'discogs')
            .single();

        if (dbError || !tokenRecord) {
            return res.status(404).json({ error: 'Hittade inget kopplat Discogs-konto. Gå till inställningar och koppla kontot först.' });
        }

        const userToken = { 
            key: tokenRecord.access_token, 
            secret: tokenRecord.token_secret 
        };

        // 2. Hämta användarnamn från Discogs identity-endpoint
        const identityUrl = 'https://api.discogs.com/oauth/identity';
        const identityAuthHeader = oauth.toHeader(oauth.authorize({ url: identityUrl, method: 'GET' }, userToken));
        const identityResponse = await axios.get(identityUrl, {
            headers: { 'Authorization': identityAuthHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' }
        });
        const username = identityResponse.data.username;

        // 3. Hämta skivor för den angivna sidan (100 åt gången)
        const collectionUrl = `https://api.discogs.com/users/${username}/collection/folders/0/releases?page=${page}&per_page=100`;
        const collectionAuthHeader = oauth.toHeader(oauth.authorize({ url: collectionUrl, method: 'GET' }, userToken));
        const collectionResponse = await axios.get(collectionUrl, {
            headers: { 'Authorization': collectionAuthHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' }
        });

        const releases = collectionResponse.data.releases;

        // 4. Omformatera datan så den passar vår Supabase-tabell
        const dbRecords = releases.map(item => ({
            user_id: user_id,
            instance_id: item.instance_id, // Unikt ID för det specifika fysiska exemplaret
            release_id: item.id,           // ID för själva utgåvan
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

        // 5. Spara eller uppdatera i databasen (Upsert kollar på kombinationen user_id + instance_id)
        if (dbRecords.length > 0) {
            const { error } = await supabase.from('skivor').upsert(dbRecords, { onConflict: 'user_id, instance_id' });
            if (error) throw error;
        }

        res.json({
            message: `Sida ${page} synkad.`,
            pagination: collectionResponse.data.pagination
        });

    } catch (error) {
        console.error('Synk Fel:', error);
        const detailedError = error.details || error.message || 'Okänt fel';
        res.status(500).json({ error: `Serverfel: ${detailedError}` });
    }
});

/* =========================================================================
   RUTT 2: Hämta skivor blixtsnabbt från vår egen Supabase-databas
   ========================================================================= */
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
            .order('artist', { ascending: true }) // Alfabetisk sortering direkt i databasen
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

/* =========================================================================
   RUTT 3: Hämta låtlista OCH prisvärdering från Discogs (Säker version)
   ========================================================================= */
router.get('/release/:id', async (req, res) => {
    // Ändrat från token/secret till user_id i queryn
    const { user_id } = req.query;
    const releaseId = req.params.id;

    if (!user_id) return res.status(400).json({ error: 'Saknar användar-ID.' });

    try {
        // 1. Hämta tokens från databasen
        const { data: tokenRecord, error: dbError } = await supabase
            .from('plattform_tokens')
            .select('access_token, token_secret')
            .eq('user_id', user_id)
            .eq('plattform', 'discogs')
            .single();

        if (dbError || !tokenRecord) {
            return res.status(404).json({ error: 'Koppling till Discogs saknas eller har upphört.' });
        }

        const userToken = { 
            key: tokenRecord.access_token, 
            secret: tokenRecord.token_secret 
        };

        // 2. Sätt upp endpoints och headers mot Discogs API
        const releaseUrl = `https://api.discogs.com/releases/${releaseId}`;
        const releaseAuthHeader = oauth.toHeader(oauth.authorize({ url: releaseUrl, method: 'GET' }, userToken));
        
        const priceUrl = `https://api.discogs.com/marketplace/price_suggestions/${releaseId}`;
        const priceAuthHeader = oauth.toHeader(oauth.authorize({ url: priceUrl, method: 'GET' }, userToken));

        // 3. Gör parallella anrop för att spara laddningstid
        const [releaseRes, priceRes] = await Promise.allSettled([
            axios.get(releaseUrl, { headers: { 'Authorization': releaseAuthHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' } }),
            axios.get(priceUrl, { headers: { 'Authorization': priceAuthHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' } })
        ]);

        const responseData = {};
        if (releaseRes.status === 'fulfilled') responseData.tracklist = releaseRes.value.data.tracklist;
        if (priceRes.status === 'fulfilled') responseData.prices = priceRes.value.data;

        res.json(responseData);
        
    } catch (error) {
        console.error('Fel vid hämtning av utgåva från Discogs:', error.message);
        res.status(500).json({ error: 'Kunde inte hämta release-data.' });
    }
});

module.exports = router;
