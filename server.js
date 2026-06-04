require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 1. Importera alla dina rutter från routes-mappen
const authRoutes = require('./routes/auth');
const discogsRoutes = require('./routes/discogs');
const traderaRoutes = require('./routes/tradera');

// 2. Berätta för servern vilka webbadresser som går till vilken fil
app.use('/api/auth', authRoutes);
app.use('/api/discogs', discogsRoutes);
app.use('/api/tradera', traderaRoutes); // Det är denna rad som saknades för att länken ska fungera!

// Den vanliga välkomst-rutten
app.get('/', (req, res) => {
    res.json({ message: 'Välkommen till Tradeogs API! Servern är live.' });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Lokal server är igång på http://localhost:${PORT}`);
    });
}

module.exports = app;
