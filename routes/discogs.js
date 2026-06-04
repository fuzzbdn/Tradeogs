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
    // Nu behöver vi bara token och secret från adressfältet!
    const { token, secret } = req.query;

    if (!token || !secret) {
        return res.status(400).json({ error: 'Saknar Discogs-nycklar. Har du kopplat kontot?' });
    }

    const userToken = { key: token, secret: secret };

    try {
        // STEG 1: Fråga Discogs API vem som äger dessa nycklar (Identity)
        const identityUrl = 'https://api.discogs.com/oauth/identity';
        const identityRequest = { url: identityUrl, method: 'GET' };
        const identityAuthHeader = oauth.toHeader(oauth.authorize(identityRequest, userToken));

        const identityResponse = await axios.get(identityUrl, {
            headers: { 
                'Authorization': identityAuthHeader['Authorization'],
                'User-Agent': 'Tradeogs/1.0'
            }
        });

        // Plocka ut användarnamnet automatiskt!
        const username = identityResponse.data.username;

// STEG 2: Använd namnet för att hämta samlingen (Hämtar nu 100 skivor åt gången)
        const collectionUrl = `https://api.discogs.com/users/${username}/collection/folders/0/releases?per_page=100`;
        const collectionRequest = { url: collectionUrl, method: 'GET' };
        const collectionAuthHeader = oauth.toHeader(oauth.authorize(collectionRequest, userToken));

        const collectionResponse = await axios.get(collectionUrl, {
            headers: { 
                'Authorization': collectionAuthHeader['Authorization'],
                'User-Agent': 'Tradeogs/1.0'
            }
        });

        // Plocka ut datan, nu med skivbolag tillagt!
        const releases = collectionResponse.data.releases.map(item => ({
            id: item.id,
            artist: item.basic_information.artists[0].name,
            titel: item.basic_information.title,
            ar: item.basic_information.year,
            format: item.basic_information.formats[0].name,
            bolag: item.basic_information.labels ? item.basic_information.labels[0].name : 'Okänt',
            bild: item.basic_information.thumb || '' 
        }));

        res.json({
            message: 'Hämtning lyckades!',
            username: username,
            totalt_i_samlingen: collectionResponse.data.pagination.items,
            skivor: releases
        });

    } catch (error) {
        console.error('Discogs API Fel:', error.message);
        res.status(500).json({ error: 'Kunde inte hämta samlingen från Discogs.' });
    }
});

module.exports = router;
