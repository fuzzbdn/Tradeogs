const express = require('express');
const router = express.Router();

// SKOTTSÄKER TVÄTT: Tar bort alla citattecken, mellanslag, radbrytningar och skräptecken!
const TRADERA_APP_ID = process.env.TRADERA_APP_ID ? process.env.TRADERA_APP_ID.replace(/[^a-zA-Z0-9-]/g, '') : '';
const TRADERA_APP_KEY = process.env.TRADERA_APP_KEY ? process.env.TRADERA_APP_KEY.replace(/[^a-zA-Z0-9-]/g, '') : ''; 

router.get('/login', (req, res) => {
    // Nu är vi 100% säkra på att nycklarna är helt rena
    const traderaAuthUrl = `https://api.tradera.com/token-login?appId=${TRADERA_APP_ID}&pkey=${TRADERA_APP_KEY}`;
    
    res.redirect(traderaAuthUrl);
});

router.get('/callback', (req, res) => {
    const { token, userId, exp } = req.query;

    if (!token) {
        return res.status(400).send('Ingen auktorisering mottogs från Tradera.');
    }

    res.json({
        message: 'Tradera-inloggningen lyckades!',
        tradera_token: token,
        tradera_user_id: userId,
        expires: exp
    });
});

module.exports = router;
