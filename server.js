require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Importera våra rutter
const authRoutes = require('./routes/auth');

// Säg åt servern att använda rutterna
app.use('/api/auth', authRoutes);

const discogsRoutes = require('./routes/discogs');
app.use('/api/discogs', discogsRoutes);

const traderaRoutes = require('./routes/tradera');
app.use('/api/tradera', traderaRoutes);

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
