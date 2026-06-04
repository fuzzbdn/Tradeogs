const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');

// Vi sätter upp samma krypteringsverktyg som i auth.js
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

// Rutt för att hämta skivsamlingen (Mapp 0 = Alla skivor)
router.get('/collection', async (req, res) => {
    // För testet hämtar vi variablerna direkt från webbadressen
    const { username, token, secret } = req.query;

    if (!username || !token || !secret) {
        return res.status(400).json({ error: 'Saknar parametrar. Behöver username, token och secret i adressen.' });
    }

    const userToken = { key: token, secret: secret };
    const url = `https://api.discogs.com/users/${username}/collection/folders/0/releases`;

    const requestData = { url: url, method: 'GET' };

    try {
        // Signera anropet med dina personliga nycklar
        const authHeader = oauth.toHeader(oauth.authorize(requestData, userToken));
        
        const response = await axios.get(url, {
            headers: { 
                'Authorization': authHeader['Authorization'],
                'User-Agent': 'Tradeogs/1.0'
            }
        });

        // För att skärmen inte ska explodera av text plockar vi bara ut de 5 första skivorna, 
        // och bara exakt den data vi senare behöver för Tradera-annonsen
        const releases = response.data.releases.slice(0, 5).map(item => ({
            artist: item.basic_information.artists[0].name,
            titel: item.basic_information.title,
            ar: item.basic_information.year,
            format: item.basic_information.formats[0].name
        }));

        res.json({
            message: 'Hämtning lyckades! Här är dina skivor:',
            totalt_i_samlingen: response.data.pagination.items,
            test_skivor: releases
        });

    } catch (error) {
        console.error('Discogs API Fel:', error.message);
        res.status(500).json({ error: 'Kunde inte hämta samlingen från Discogs.' });
    }
});

module.exports = router;
