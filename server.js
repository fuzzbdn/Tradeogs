require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Gör att vi kan ta emot JSON-data

// En enkel test-rutt för att se att allt fungerar
app.get('/', (req, res) => {
    res.json({ message: 'Välkommen till Tradeogs API! Servern är live.' });
});

// Port för lokal utveckling
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Lokal server är igång på http://localhost:${PORT}`);
    });
}

// Måste exporteras för att Vercel ska kunna köra den som en serverless function
module.exports = app;
