/* =========================================
   1. SÄKERHET & KONTROLLER (Körs vid laddning)
   ========================================= */
(function checkAuthentication() {
    // Kollar om användaren är på dashboarden (vi vill inte kasta ut dem från inloggningssidan)
    const isDashboard = window.location.pathname.includes('dashboard.html');
    let session = localStorage.getItem('supabase_session');

    // Fångar upp nycklar i adressfältet (från Google eller Discogs)
    if (isDashboard && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        // Google Auth
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
            const oauthSession = { access_token: accessToken, refresh_token: refreshToken };
            localStorage.setItem('supabase_session', JSON.stringify(oauthSession));
            session = JSON.stringify(oauthSession);
            history.replaceState(null, null, window.location.pathname);
        }

        // Discogs Auth
        const discogsToken = params.get('discogs_token');
        const discogsSecret = params.get('discogs_secret');
        
        if (discogsToken && discogsSecret) {
            localStorage.setItem('discogs_token', discogsToken);
            localStorage.setItem('discogs_secret', discogsSecret);
            history.replaceState(null, null, window.location.pathname);
        }
    }

    // Har man ingen session och försöker nå dashboarden -> Skicka till login
    if (isDashboard && !session) {
        window.location.href = '/index.html';
    }
})();

/* =========================================
   2. INITIALISERA GRÄNSSNITTET
   ========================================= */
document.addEventListener("DOMContentLoaded", function() {
    // Kollar om Discogs är kopplat och uppdaterar knappen på dashboarden
    const discogsToken = localStorage.getItem('discogs_token');
    const discogsBtn = document.querySelector('.btn-discogs');
    
    if (discogsToken && discogsBtn) {
        discogsBtn.innerText = "✅ Discogs är kopplat";
        discogsBtn.style.backgroundColor = "#51cf66";
        discogsBtn.style.borderColor = "#51cf66";
        discogsBtn.style.pointerEvents = "none"; // Gör den oklickbar
    }
});

/* =========================================
   3. INLOGGNING OCH REGISTRERING
   ========================================= */
async function loginUser() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const statusDiv = document.getElementById('status-message');

    if (!email || !password) {
        statusDiv.style.color = '#ff4757';
        statusDiv.innerText = 'Vänligen fyll i både e-post och lösenord.';
        return;
    }

    statusDiv.style.color = '#666';
    statusDiv.innerText = 'Loggar in...';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok) throw new Error(result.error || 'Något gick fel vid inloggningen.');

        localStorage.setItem('supabase_session', JSON.stringify(result.session));
        window.location.href = '/dashboard.html';

    } catch (error) {
        statusDiv.style.color = '#ff4757';
        statusDiv.innerText = error.message;
    }
}

async function registerUser() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    const statusDiv = document.getElementById('status-message');

    if (!email || !password || !confirmPassword) {
        statusDiv.style.color = '#ff4757';
        statusDiv.innerText = 'Vänligen fyll i alla fält.';
        return;
    }

    if (password !== confirmPassword) {
        statusDiv.style.color = '#ff4757';
        statusDiv.innerText = 'Lösenorden matchar inte varandra.';
        return;
    }

    if (password.length < 6) {
        statusDiv.style.color = '#ff4757';
        statusDiv.innerText = 'Lösenordet måste vara minst 6 tecken långt.';
        return;
    }

    statusDiv.style.color = '#666';
    statusDiv.innerText = 'Skapar konto...';

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok) throw new Error(result.error || 'Något gick fel.');

        if (result.session) {
            localStorage.setItem('supabase_session', JSON.stringify(result.session));
        }

        statusDiv.style.color = '#51cf66';
        statusDiv.innerText = 'Konto skapat! Skickar dig vidare...';
        
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1500);

    } catch (error) {
        statusDiv.style.color = '#ff4757';
        statusDiv.innerText = error.message;
    }
}

/* =========================================
   4. DASHBOARD-FUNKTIONER
   ========================================= */
function switchView(viewName) {
    // Dölj alla vy-sektioner
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Avmarkera alla menyval i sidebar
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });

    // Visa den valda vyn och markera menyn
    const viewElement = document.getElementById('view-' + viewName);
    const navElement = document.getElementById('nav-' + viewName);
    
    if (viewElement) viewElement.classList.add('active');
    if (navElement) navElement.classList.add('active');
}

function logout() {
    localStorage.removeItem('supabase_session');
    localStorage.removeItem('discogs_token');
    localStorage.removeItem('discogs_secret');
    window.location.href = '/index.html';
}
