const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient'); // Hämtar databaskopplingen

// En test-rutt för att se att filen är korrekt inkopplad
router.get('/test', async (req, res) => {
    res.json({ message: 'Auth-systemet är inkopplat och redo för Discogs!' });
});

// Här kommer vi senare lägga in /discogs/login och /tradera/login

module.exports = router;
