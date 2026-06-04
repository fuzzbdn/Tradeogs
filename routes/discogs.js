const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');

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

// RUTT 1: Hämta samlingen med pagination
router.get('/collection', async (req, res) => {
    const { token, secret, limit, page } = req.query;

    if (!token || !secret) {
        return res.status(401).json({ error: 'Saknar Discogs-nycklar.' });
    }

    const perPage = limit || '25'; 
    const currentPage = page || '1';
    const userToken = { key: token, secret: secret };

    try {
        const identityUrl = 'https://api.discogs.com/oauth/identity';
        const identityAuthHeader = oauth.toHeader(oauth.authorize({ url: identityUrl, method: 'GET' }, userToken));
        const identityResponse = await axios.get(identityUrl, {
            headers: { 'Authorization': identityAuthHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' }
        });

        const username = identityResponse.data.username;

        // Här lägger vi till sort och page parametrarna
        const collectionUrl = `https://api.discogs.com/users/${username}/collection/folders/0/releases?sort=artist&sort_order=asc&page=${currentPage}&per_page=${perPage}`;
        const collectionAuthHeader = oauth.toHeader(oauth.authorize({ url: collectionUrl, method: 'GET' }, userToken));
        
        const collectionResponse = await axios.get(collectionUrl, {
            headers: { 'Authorization': collectionAuthHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' }
        });

        const releases = collectionResponse.data.releases.map(item => ({
            id: item.id,
            artist: item.basic_information.artists[0].name,
            titel: item.basic_information.title,
            ar: item.basic_information.year,
            format: item.basic_information.formats[0].name,
            bolag: item.basic_information.labels ? item.basic_information.labels[0].name : 'Okänt',
            katalognummer: item.basic_information.labels ? item.basic_information.labels[0].catno : 'Okänt',
            discogs_url: `https://www.discogs.com/release/${item.id}`,
            bild: item.basic_information.thumb || '',
            genre: item.basic_information.genres ? item.basic_information.genres.join(', ') : 'Okänd genre',
            stil: item.basic_information.styles ? item.basic_information.styles.join(', ') : ''
        }));

        res.json({
            message: 'Hämtning lyckades!',
            username: username,
            totalt_i_samlingen: collectionResponse.data.pagination.items,
            pagination: collectionResponse.data.pagination,
            skivor: releases
        });

    } catch (error) {
        console.error('Discogs API Fel:', error.message);
        res.status(500).json({ error: 'Kunde inte hämta samlingen.' });
    }
});

// RUTT 2: Hämta låtlista OCH prisvärdering dynamiskt
router.get('/release/:id', async (req, res) => {
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
        
        if (releaseRes.status === 'fulfilled') {
            responseData.tracklist = releaseRes.value.data.tracklist;
        }

        if (priceRes.status === 'fulfilled') {
            responseData.prices = priceRes.value.data;
        }

        res.json(responseData);
    } catch (error) {
        console.error('Discogs API Fel (Release):', error.message);
        res.status(500).json({ error: 'Kunde inte hämta release-data.' });
    }
});

module.exports = router;
