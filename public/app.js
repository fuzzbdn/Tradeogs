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
/* =========================================
   5. DISCOGS - HÄMTA, SÖK & INSTÄLLNINGAR
   ========================================= */
window.myCollection = []; // Global variabel för att spara listan i minnet

// Ladda sparade inställningar när sidan startar
document.addEventListener("DOMContentLoaded", function() {
    const savedSettings = localStorage.getItem('tradeogs_display');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (document.getElementById('set-bild')) document.getElementById('set-bild').checked = settings.bild;
        if (document.getElementById('set-format')) document.getElementById('set-format').checked = settings.format;
        if (document.getElementById('set-ar')) document.getElementById('set-ar').checked = settings.ar;
        if (document.getElementById('set-bolag')) document.getElementById('set-bolag').checked = settings.bolag;
    }
});

// Spara inställningar när man klickar på "Spara"
function saveDisplaySettings() {
    const settings = {
        bild: document.getElementById('set-bild').checked,
        format: document.getElementById('set-format').checked,
        ar: document.getElementById('set-ar').checked,
        bolag: document.getElementById('set-bolag').checked
    };
    localStorage.setItem('tradeogs_display', JSON.stringify(settings));
    
    // Byt text på knappen tillfälligt för feedback
    const btn = document.querySelector('button[onclick="saveDisplaySettings()"]');
    const oldText = btn.innerText;
    btn.innerText = "✅ Sparat!";
    btn.style.backgroundColor = "#51cf66";
    btn.style.color = "white";
    
    setTimeout(() => {
        btn.innerText = oldText;
        btn.style.backgroundColor = "transparent";
        btn.style.color = "#555";
    }, 2000);

    // Rita om listan direkt om vi har skivor laddade
    if (window.myCollection.length > 0) {
        renderCollection(window.myCollection);
    }
}

// Hämta listan från backend
async function fetchCollection() {
    const token = localStorage.getItem('discogs_token');
    const secret = localStorage.getItem('discogs_secret');
    const statusDiv = document.getElementById('collection-status');

    if (!token || !secret) {
        statusDiv.innerHTML = '<p style="color: #ff4757; font-weight: bold;">❌ Du måste koppla ditt Discogs-konto under Inställningar först!</p>';
        return;
    }

    statusDiv.innerHTML = '<p style="color: #666;">Hämtar samling från Discogs... ⏳</p>';
    document.getElementById('collection-list').innerHTML = '';

    try {
        const response = await fetch(`/api/discogs/collection?token=${token}&secret=${secret}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Något gick fel.');

        // Spara skivorna i minnet för live-sökning
        window.myCollection = data.skivor; 

        statusDiv.innerHTML = `
            <p style="color: #51cf66; font-weight: bold;">
                ✅ Hittade användare: ${data.username} <br>
                Visar ${data.skivor.length} av totalt ${data.totalt_i_samlingen} sparade skivor.
            </p>`;
        
        // Visa sökfältet nu när vi har data
        document.getElementById('search-container').style.display = 'block';
        
        // Rita ut listan
        renderCollection(window.myCollection);

    } catch (error) {
        statusDiv.innerHTML = `<p style="color: #ff4757; font-weight: bold;">Fel: ${error.message}</p>`;
    }
}

// Sökfunktion (Körs varje gång du trycker på en tangent i sökfältet)
function filterCollection() {
    const query = document.getElementById('search-input').value.toLowerCase();
    
    // Filtrera fram skivor där artist eller titel matchar sökningen
    const filteredList = window.myCollection.filter(skiva => {
        return skiva.artist.toLowerCase().includes(query) || skiva.titel.toLowerCase().includes(query);
    });

    renderCollection(filteredList);
}

// Funktionen som bygger upp HTML:en för skivorna baserat på dina inställningar
// Funktionen som bygger upp HTML:en för skivorna baserat på dina inställningar
function renderCollection(skivor) {
    const listDiv = document.getElementById('collection-list');
    listDiv.innerHTML = ''; // Töm den gamla listan

    // Hämta aktuella inställningar
    const settings = JSON.parse(localStorage.getItem('tradeogs_display')) || { bild: true, format: true, ar: true, bolag: false };

    if (skivor.length === 0) {
        listDiv.innerHTML = '<p style="color: #888;">Inga skivor hittades.</p>';
        return;
    }

    skivor.forEach(skiva => {
        // Huvudbehållaren för hela skivan (både minimerad och expanderad vy)
        const item = document.createElement('div');
        item.style.cssText = "border: 1px solid #e1e4e8; border-radius: 8px; background: #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.02); overflow: hidden; transition: all 0.2s;";
        
        // 1. Bygg bilden för den kompakta vyn
        let bildHtml = '';
        if (settings.bild) {
            bildHtml = skiva.bild 
                ? `<img src="${skiva.bild}" alt="Omslag" style="width: 60px; height: 60px; border-radius: 4px; margin-right: 15px; object-fit: cover; border: 1px solid #ccc;">` 
                : `<div style="width: 60px; height: 60px; background: #e1e4e8; border-radius: 4px; margin-right: 15px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💿</div>`;
        }

        // 2. Bygg textraden för den kompakta vyn baserat på inställningar
        let infoArray = [];
        if (settings.format) infoArray.push(skiva.format);
        if (settings.ar) infoArray.push(skiva.ar || 'Okänt år');
        if (settings.bolag) infoArray.push(`🏷️ ${skiva.bolag}`);
        
        const extraInfo = infoArray.length > 0 
            ? `<span style="font-size: 13px; color: #666; display: block; margin-top: 4px;">${infoArray.join(' • ')}</span>`
            : '';

        // 3. Den synliga klickbara raden
        const mainRow = document.createElement('div');
        mainRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 15px; cursor: pointer;";
        
        // Notera event.stopPropagation() på knappen så att klick på knappen inte öppnar/stänger raden
        mainRow.innerHTML = `
            <div style="display: flex; align-items: center; flex-grow: 1;">
                ${bildHtml}
                <div>
                    <strong style="display: block; font-size: 16px; color: #222;">${skiva.artist} - ${skiva.titel}</strong>
                    ${extraInfo}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="color: #aaa; font-size: 12px;">▼ Info</span>
                <button class="btn btn-tradera" onclick="event.stopPropagation(); alert('Skapar annons för ID: ${skiva.id}')" style="margin: 0; padding: 8px 15px; font-size: 14px; width: auto;">Sälj på Tradera</button>
            </div>
        `;

        // 4. Den dolda, expanderade vyn med all information
        const detailsRow = document.createElement('div');
        detailsRow.style.cssText = "display: none; padding: 20px; border-top: 1px solid #eee; background-color: #fafafa;";
        
        const storBild = skiva.bild ? `<img src="${skiva.bild}" style="width: 120px; height: 120px; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-right: 20px; object-fit: cover;">` : '';

        detailsRow.innerHTML = `
            <div style="display: flex; align-items: flex-start;">
                ${storBild}
                <div style="flex-grow: 1;">
                    <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Detaljerad Information</h4>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;">
                        <tr style="border-bottom: 1px solid #e1e4e8;">
                            <th style="padding: 8px 0; color: #666; font-weight: normal; width: 120px;">Discogs ID:</th>
                            <td style="padding: 8px 0; font-weight: bold; color: #222;">${skiva.id}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e1e4e8;">
                            <th style="padding: 8px 0; color: #666; font-weight: normal;">Format:</th>
                            <td style="padding: 8px 0; font-weight: bold; color: #222;">${skiva.format}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e1e4e8;">
                            <th style="padding: 8px 0; color: #666; font-weight: normal;">Utgivningsår:</th>
                            <td style="padding: 8px 0; font-weight: bold; color: #222;">${skiva.ar || 'Okänt'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e1e4e8;">
                            <th style="padding: 8px 0; color: #666; font-weight: normal;">Skivbolag:</th>
                            <td style="padding: 8px 0; font-weight: bold; color: #222;">${skiva.bolag}</td>
                        </tr>
                    </table>
                </div>
            </div>
        `;

        // 5. Lägg till klick-logiken för att visa/dölja detaljerna
        mainRow.onclick = function() {
            const isHidden = detailsRow.style.display === 'none';
            detailsRow.style.display = isHidden ? 'block' : 'none';
            // Vänder på pilen visuellt
            const arrowSpan = mainRow.querySelector('span');
            arrowSpan.innerText = isHidden ? '▲ Stäng' : '▼ Info';
            arrowSpan.style.color = isHidden ? '#333' : '#aaa';
        };

        // 6. Montera ihop allt och lägg till i listan
        item.appendChild(mainRow);
        item.appendChild(detailsRow);
        listDiv.appendChild(item);
    });
}
