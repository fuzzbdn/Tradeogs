const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient'); // Vår färdiga Supabase-klient

// --- SKAPA KONTO (E-POST & LÖSENORD) ---
router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Du måste ange både e-post och lösenord.' });
    }

    try {
        // Supabase sköter kryptering av lösenord och verifieringsmejl automatiskt
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) throw error;

        res.json({
            message: 'Registrering lyckades! Kontrollera din e-post för verifieringslänk.',
            user: data.user
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// --- LOGGA IN (E-POST & LÖSENORD) ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Du måste ange både e-post och lösenord.' });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        // Här får vi en session-token som frontend kan använda för att hålla användaren inloggad
        res.json({
            message: 'Inloggningen lyckades!',
            session: data.session,
            user: data.user
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// --- STARTA INLOGGNING MED GOOGLE ---
router.get('/google', async (req, res) => {
    const HOST_URL = process.env.HOST_URL || 'http://localhost:3000';
    
    try {
        // Vi ber Supabase generera URL:en för Googles inloggningsfönster
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // Hit skickas användaren efter att ha godkänt Google-inloggningen
                redirectTo: `${HOST_URL}/index.html`, 
            },
        });

        if (error) throw error;

        // Skicka användaren vidare till Googles inloggningssida
        res.redirect(data.url);
    } catch (error) {
        res.status(500).json({ error: 'Kunde inte starta Google-inloggning: ' + error.message });
    }
});

module.exports = router;
