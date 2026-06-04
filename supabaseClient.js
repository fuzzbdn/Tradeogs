// Importera Supabase-verktygen
const { createClient } = require('@supabase/supabase-js');

// Hämta nycklarna från din .env-fil
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('VARNING: Saknar Supabase-nycklar i .env-filen!');
}

// Skapa själva klienten
const supabase = createClient(supabaseUrl, supabaseKey);

// Exportera den så att andra filer kan använda den
module.exports = supabase;
