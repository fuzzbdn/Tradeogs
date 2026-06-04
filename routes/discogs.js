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

router.get('/collection', async (req, res) => {
    const { token, secret, limit } = req.query;

    if (!token || !secret) {
        return res.status(400).json({ error: 'Saknar Discogs-nycklar.' });
    }

    const perPage = limit || '100'; 
    const userToken = { key: token, secret: secret };

    try {
        // Hämta användarens identitet
        const identityUrl = 'https://api.discogs.com/oauth/identity';
        const identityAuthHeader = oauth.toHeader(oauth.authorize({ url: identityUrl, method: 'GET' }, userToken));
        const identityResponse = await axios.get(identityUrl, {
            headers: { 'Authorization': identityAuthHeader['Authorization'], 'User-Agent': 'Tradeogs/1.0' }
        });

        const username = identityResponse.data.username;

        // Hämta samlingen med den valda limiten
        const collectionUrl = `https://api.discogs.com/users/${username}/collection/folders/0/releases?per_page=${perPage}`;
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
            bild: item.basic_information.thumb || '',
            genre: item.basic_information.genres ? item.basic_information.genres.join(', ') : 'Okänd genre',
            stil: item.basic_information.styles ? item.basic_information.styles.join(', ') : ''
        }));

        res.json({
            message: 'Hämtning lyckades!',
            username: username,
            totalt_i_samlingen: collectionResponse.data.pagination.items,
            skivor: releases
        });

    } catch (error) {
        console.error('Discogs API Fel:', error.message);
        res.status(500).json({ error: 'Kunde inte hämta samlingen.' });
    }
});

module.exports = router;
