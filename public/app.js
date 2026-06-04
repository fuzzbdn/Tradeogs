/* =========================================
   1. SÄKERHET & KONTROLLER
   ========================================= */
(function checkAuthentication() {
    const isDashboard = window.location.pathname.includes('dashboard.html');
    let session = localStorage.getItem('supabase_session');

    if (isDashboard && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
            const oauthSession = { access_token: accessToken, refresh_token: refreshToken };
            localStorage.setItem('supabase_session', JSON.stringify(oauthSession));
            session = JSON.stringify(oauthSession);
            history.replaceState(null, null, window.location.pathname);
        }

        const discogsToken = params.get('discogs_token');
        const discogsSecret = params.get('discogs_secret');
        
        if (discogsToken && discogsSecret) {
            localStorage.setItem('discogs_token', discogsToken);
            localStorage.setItem('discogs_secret', discogsSecret);
            history.replaceState(null, null, window.location.pathname);
        }
    }

    if (isDashboard && !session) window.location.href = '/index.html';
})();

/* =========================================
   2. INITIALISERA GRÄNSSNITTET
   ========================================= */
document.addEventListener("DOMContentLoaded", function() {
    const discogsToken = localStorage.getItem('discogs_token');
    const discogsBtn = document.querySelector('.btn-discogs');
    
    if (discogsToken && discogsBtn) {
        discogsBtn.innerText = "✅ Discogs är kopplat";
        discogsBtn.style.backgroundColor = "#51cf66";
        discogsBtn.style.borderColor = "#51cf66";
        discogsBtn.style.pointerEvents = "none";
    }

    const savedSettings = localStorage.getItem('tradeogs_display');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        const setChecked = (id, val) => { if(document.getElementById(id)) document.getElementById(id).checked = val; };
        
        setChecked('set-bild', settings.bild);
        setChecked('set-format', settings.format);
        setChecked('set-ar', settings.ar);
        setChecked('set-bolag', settings.bolag);
        setChecked('set-genre', settings.genre);
        setChecked('set-tracklist', settings.tracklist);
        setChecked('set-katalog', settings.katalog); // NY
        setChecked('set-url', settings.url); // NY
        setChecked('set-matrix', settings.matrix);
        setChecked('set-price', settings.price);

        if (document.getElementById('set-limit')) {
            document.getElementById('set-limit').value = settings.limit || '100';
        }
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
        statusDiv.style.color = '#ff4757'; statusDiv.innerText = 'Vänligen fyll i både e-post och lösenord.'; return;
    }

    statusDiv.style.color = '#666'; statusDiv.innerText = 'Loggar in...';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Något gick fel.');
        localStorage.setItem('supabase_session', JSON.stringify(result.session));
        window.location.href = '/dashboard.html';
    } catch (error) {
        statusDiv.style.color = '#ff4757'; statusDiv.innerText = error.message;
    }
}

async function registerUser() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    const statusDiv = document.getElementById('status-message');

    if (!email || !password || !confirmPassword) { statusDiv.style.color = '#ff4757'; statusDiv.innerText = 'Fyll i alla fält.'; return; }
    if (password !== confirmPassword) { statusDiv.style.color = '#ff4757'; statusDiv.innerText = 'Lösenorden matchar inte.'; return; }
    if (password.length < 6) { statusDiv.style.color = '#ff4757'; statusDiv.innerText = 'Lösenordet måste vara minst 6 tecken.'; return; }

    statusDiv.style.color = '#666'; statusDiv.innerText = 'Skapar konto...';

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Något gick fel.');
        if (result.session) localStorage.setItem('supabase_session', JSON.stringify(result.session));
        statusDiv.style.color = '#51cf66'; statusDiv.innerText = 'Konto skapat! Skickar dig vidare...';
        setTimeout(() => { window.location.href = '/dashboard.html'; }, 1500);
    } catch (error) {
        statusDiv.style.color = '#ff4757'; statusDiv.innerText = error.message;
    }
}

/* =========================================
   4. DASHBOARD-FUNKTIONER & INSTÄLLNINGAR
   ========================================= */
function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.getElementById('view-' + viewName)?.classList.add('active');
    document.getElementById('nav-' + viewName)?.classList.add('active');
}

function logout() {
    localStorage.removeItem('supabase_session');
    localStorage.removeItem('discogs_token');
    localStorage.removeItem('discogs_secret');
    window.location.href = '/index.html';
}

function saveDisplaySettings() {
    const settings = {
        bild: document.getElementById('set-bild').checked,
        format: document.getElementById('set-format').checked,
        ar: document.getElementById('set-ar').checked,
        bolag: document.getElementById('set-bolag').checked,
        genre: document.getElementById('set-genre').checked,
        tracklist: document.getElementById('set-tracklist').checked,
        katalog: document.getElementById('set-katalog').checked, // NY
        url: document.getElementById('set-url').checked, // NY
        matrix: document.getElementById('set-matrix').checked,
        price: document.getElementById('set-price').checked,
        limit: document.getElementById('set-limit').value
    };
    localStorage.setItem('tradeogs_display', JSON.stringify(settings));
    
    const btn = document.querySelector('button[onclick="saveDisplaySettings()"]');
    const oldText = btn.innerText;
    btn.innerText = "✅ Sparat!"; btn.style.backgroundColor = "#51cf66"; btn.style.color = "white";
    setTimeout(() => { btn.innerText = oldText; btn.style.backgroundColor = "transparent"; btn.style.color = "#555"; }, 2000);

    if (window.myCollection && window.myCollection.length > 0) renderCollection(window.myCollection);
}

/* =========================================
   5. DISCOGS - HÄMTA & RITA UT SAMLING
   ========================================= */
window.myCollection = []; 

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

    const settings = JSON.parse(localStorage.getItem('tradeogs_display')) || {};
    const limit = settings.limit || '100';

    try {
        const response = await fetch(`/api/discogs/collection?token=${token}&secret=${secret}&limit=${limit}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Något gick fel.');

        window.myCollection = data.skivor; 

        statusDiv.innerHTML = `
            <p style="color: #51cf66; font-weight: bold;">
                ✅ Hittade användare: ${data.username} <br>
                Visar ${data.skivor.length} av totalt ${data.totalt_i_samlingen} sparade skivor.
            </p>`;
        
        document.getElementById('search-container').style.display = 'block';
        renderCollection(window.myCollection);

    } catch (error) {
        statusDiv.innerHTML = `<p style="color: #ff4757; font-weight: bold;">Fel: ${error.message}</p>`;
    }
}

function filterCollection() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filteredList = window.myCollection.filter(skiva => {
        return skiva.artist.toLowerCase().includes(query) || skiva.titel.toLowerCase().includes(query);
    });
    renderCollection(filteredList);
}

function renderCollection(skivor) {
    const listDiv = document.getElementById('collection-list');
    listDiv.innerHTML = ''; 

    // STANDARDINSTÄLLNINGAR OM INGET ÄR SPARAT
    const settings = JSON.parse(localStorage.getItem('tradeogs_display')) || { 
        bild: true, format: true, ar: true, bolag: false, genre: true, 
        tracklist: true, katalog: true, url: true, matrix: false, price: true 
    };

    if (skivor.length === 0) {
        listDiv.innerHTML = '<p style="color: #888;">Inga skivor hittades.</p>';
        return;
    }

    skivor.forEach(skiva => {
        const item = document.createElement('div');
        item.style.cssText = "border: 1px solid #e1e4e8; border-radius: 8px; background: #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.02); overflow: hidden; transition: all 0.2s;";
        
        let bildHtml = '';
        if (settings.bild) {
            bildHtml = skiva.bild 
                ? `<img src="${skiva.bild}" alt="Omslag" style="width: 60px; height: 60px; border-radius: 4px; margin-right: 15px; object-fit: cover; border: 1px solid #ccc;">` 
                : `<div style="width: 60px; height: 60px; background: #e1e4e8; border-radius: 4px; margin-right: 15px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💿</div>`;
        }

        let infoArray = [];
        if (settings.format) infoArray.push(skiva.format);
        if (settings.ar) infoArray.push(skiva.ar || 'Okänt år');
        if (settings.bolag) infoArray.push(`🏷️ ${skiva.bolag}`);
        
        const extraInfo = infoArray.length > 0 
            ? `<span style="font-size: 13px; color: #666; display: block; margin-top: 4px;">${infoArray.join(' • ')}</span>`
            : '';

        const mainRow = document.createElement('div');
        mainRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 15px; cursor: pointer; flex-wrap: wrap; gap: 10px;";
        
        mainRow.innerHTML = `
            <div style="display: flex; align-items: center; flex-grow: 1; min-width: 0; padding-right: 15px;">
                ${bildHtml}
                <div style="min-width: 0;">
                    <strong style="display: block; font-size: 16px; color: #222; word-break: break-word;">${skiva.artist} - ${skiva.titel}</strong>
                    ${extraInfo}
                </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 15px; flex-shrink: 0;">
                <span style="color: #555; font-size: 13px; width: 65px; text-align: right; display: inline-block; font-weight: 600;">▼ Info</span>
                <button class="btn btn-tradera" onclick="event.stopPropagation(); alert('Skapar annons för ID: ${skiva.id}')" style="margin: 0; padding: 8px 15px; font-size: 14px; width: auto;">Sälj på Tradera</button>
            </div>
        `;

        const detailsRow = document.createElement('div');
        detailsRow.style.cssText = "display: none; padding: 20px; border-top: 1px solid #eee; background-color: #fafafa;";
        
        const storBild = skiva.bild ? `<img src="${skiva.bild}" style="width: 120px; height: 120px; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-right: 20px; object-fit: cover;">` : '';

        let tabellRader = `
            <tr style="border-bottom: 1px solid #e1e4e8;">
                <th style="padding: 8px 0; color: #666; font-weight: normal; width: 140px;">Discogs ID:</th>
                <td style="padding: 8px 0; font-weight: bold; color: #222;">${skiva.id}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e1e4e8;">
                <th style="padding: 8px 0; color: #666; font-weight: normal;">Format:</th>
                <td style="padding: 8px 0; font-weight: bold; color: #222;">${skiva.format}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e1e4e8;">
                <th style="padding: 8px 0; color: #666; font-weight: normal;">Skivbolag:</th>
                <td style="padding: 8px 0; font-weight: bold; color: #222;">${skiva.bolag} (${skiva.ar || 'Okänt'})</td>
            </tr>
        `;

        if (settings.katalog) {
            tabellRader += `
            <tr style="border-bottom: 1px solid #e1e4e8;">
                <th style="padding: 8px 0; color: #666; font-weight: normal;">Katalognummer:</th>
                <td style="padding: 8px 0; font-weight: bold; color: #222;">${skiva.katalognummer}</td>
            </tr>`;
        }

        if (settings.genre) {
            tabellRader += `
            <tr style="border-bottom: 1px solid #e1e4e8;">
                <th style="padding: 8px 0; color: #666; font-weight: normal;">Genre / Stil:</th>
                <td style="padding: 8px 0; font-weight: bold; color: #222;">${skiva.genre} ${skiva.stil ? '- ' + skiva.stil : ''}</td>
            </tr>`;
        }
        
        if (settings.tracklist) {
            tabellRader += `
            <tr style="border-bottom: 1px solid #e1e4e8;">
                <th style="padding: 8px 0; color: #666; font-weight: normal; vertical-align: top;">Låtlista:</th>
                <td style="padding: 8px 0; font-weight: normal; color: #666;" id="tracklist-${skiva.id}">
                    <span style="font-style: italic;">Laddar låtlista... ⏳</span>
                </td>
            </tr>`;
        }

        if (settings.url) {
            tabellRader += `
            <tr style="border-bottom: 1px solid #e1e4e8;">
                <th style="padding: 8px 0; color: #666; font-weight: normal;">Discogslänk:</th>
                <td style="padding: 8px 0;">
                    <a href="${skiva.discogs_url}" target="_blank" style="color: #4285F4; text-decoration: none; font-weight: bold;">Öppna på Discogs ↗</a>
                </td>
            </tr>`;
        }

        detailsRow.innerHTML = `
            <div style="display: flex; align-items: flex-start;">
                ${storBild}
                <div style="flex-grow: 1;">
                    <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Detaljerad Information</h4>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;">
                        ${tabellRader}
                    </table>
                </div>
            </div>
        `;

        mainRow.onclick = async function() {
            const isHidden = detailsRow.style.display === 'none';
            detailsRow.style.display = isHidden ? 'block' : 'none';
            const arrowSpan = mainRow.querySelector('span');
            arrowSpan.innerText = isHidden ? '▲ Stäng' : '▼ Info';
            arrowSpan.style.color = isHidden ? '#333' : '#aaa';

            // HÄMTA LÅTLISTAN DYNAMISKT! (Bara om det behövs)
            if (isHidden && settings.tracklist) {
                const tracklistTd = document.getElementById(`tracklist-${skiva.id}`);
                
                // Körs bara om texten innehåller "Laddar"
                if (tracklistTd && tracklistTd.innerText.includes('Laddar')) {
                    const token = localStorage.getItem('discogs_token');
                    const secret = localStorage.getItem('discogs_secret');
                    
                    try {
                        const response = await fetch(`/api/discogs/release/${skiva.id}?token=${token}&secret=${secret}`);
                        const data = await response.json();
                        
                        if (data.tracklist && data.tracklist.length > 0) {
                            let html = '<ul style="margin: 0; padding-left: 20px;">';
                            data.tracklist.forEach(track => {
                                html += `<li style="margin-bottom: 4px;"><strong>${track.position || '-'}</strong> ${track.title} <em style="color: #888;">${track.duration || ''}</em></li>`;
                            });
                            html += '</ul>';
                            tracklistTd.innerHTML = html;
                        } else {
                            tracklistTd.innerHTML = '<span style="color: #888;">Ingen låtlista hittades.</span>';
                        }
                    } catch (e) {
                        tracklistTd.innerHTML = '<span style="color: #ff4757;">Kunde inte hämta låtlista.</span>';
                    }
                }
            }
        };

        item.appendChild(mainRow);
        item.appendChild(detailsRow);
        listDiv.appendChild(item);
    });
}
