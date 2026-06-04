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
let currentPage = 1;
let isLoading = false;
window.myCollection = []; 

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
        setChecked('set-katalog', settings.katalog);
        setChecked('set-url', settings.url);
        setChecked('set-price', settings.price);
    }

    // Starta på samlingen direkt om vi är på dashboard
    if (window.location.pathname.includes('dashboard.html')) {
        switchView('collection');
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

    if (viewName === 'collection' && window.myCollection.length === 0) {
        fetchCollection(1);
    }
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
        katalog: document.getElementById('set-katalog').checked,
        url: document.getElementById('set-url').checked,
        price: document.getElementById('set-price').checked
    };
    localStorage.setItem('tradeogs_display', JSON.stringify(settings));
    
    const btn = document.querySelector('button[onclick="saveDisplaySettings()"]');
    const oldText = btn.innerText;
    btn.innerText = "✅ Sparat!"; btn.style.backgroundColor = "#51cf66"; btn.style.color = "white";
    setTimeout(() => { btn.innerText = oldText; btn.style.backgroundColor = "transparent"; btn.style.color = "#555"; }, 2000);

    if (window.myCollection && window.myCollection.length > 0) renderCollection(window.myCollection, false);
}

/* =========================================
   5. DATABAS, SYNK & RITA UT SAMLING
   ========================================= */
let searchTimeout = null;

async function startSync() {
    const token = localStorage.getItem('discogs_token');
    const secret = localStorage.getItem('discogs_secret');
    const session = JSON.parse(localStorage.getItem('supabase_session'));
    const statusDiv = document.getElementById('collection-status');
    const syncBtn = document.getElementById('sync-btn');

    if (!token || !secret) {
        alert("Du måste koppla Discogs i inställningarna först!");
        return;
    }

    syncBtn.disabled = true;
    syncBtn.innerText = "⏳ Synkar...";
    
    let currentPageToSync = 1;
    let totalPages = 1;

    statusDiv.innerHTML = `<p style="color: #4285F4; font-weight: bold;">📥 Påbörjar synkronisering av din samling till Tradeogs-databasen...</p>`;

    while (currentPageToSync <= totalPages) {
        try {
            statusDiv.innerHTML = `<p style="color: #4285F4;">Laddar ner sida ${currentPageToSync} av ${totalPages}... Vänligen stäng inte sidan.</p>`;
            
            const response = await fetch('/api/discogs/sync-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token, secret, user_id: session.user.id, page: currentPageToSync
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            totalPages = data.pagination.pages;
            currentPageToSync++;

            if (currentPageToSync <= totalPages) {
                await new Promise(r => setTimeout(r, 1500)); 
            }

        } catch (error) {
            statusDiv.innerHTML = `<p style="color: #ff4757; font-weight: bold;">❌ Synk avbröts: ${error.message}</p>`;
            syncBtn.disabled = false;
            syncBtn.innerText = "🔄 Försök igen";
            return;
        }
    }

    statusDiv.innerHTML = `<p style="color: #51cf66; font-weight: bold;">✅ Samlingen är färdigsynkad! Laddar om vyn...</p>`;
    syncBtn.disabled = false;
    syncBtn.innerText = "🔄 Synka från Discogs";
    
    fetchCollection(1);
}

async function fetchCollection(page = 1) {
    if (isLoading) return;
    isLoading = true;

    const session = JSON.parse(localStorage.getItem('supabase_session'));
    const statusDiv = document.getElementById('collection-status');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const searchTerm = document.getElementById('search-input')?.value || '';

    if (!session) {
        isLoading = false;
        return;
    }

    if (page === 1) {
        document.getElementById('collection-list').innerHTML = '';
        window.myCollection = [];
        if (!searchTerm) statusDiv.innerHTML = '<p style="color: #666;">Hämtar från databasen... ⏳</p>';
    } else {
        if (loadMoreBtn) loadMoreBtn.innerText = 'Laddar... ⏳';
    }

    try {
        const response = await fetch(`/api/discogs/collection?user_id=${session.user.id}&page=${page}&limit=25&search=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Något gick fel vid hämtningen.');

        if (data.totalt_i_samlingen === 0 && !searchTerm) {
            statusDiv.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: #fff; border-radius: 8px; border: 1px dashed #ccc;">
                    <p style="color: #666; font-size: 16px; margin-bottom: 20px;">Din databas är tom! Klicka på knappen ovan för att synka in dina skivor från Discogs.</p>
                </div>`;
            isLoading = false;
            return;
        }

        window.myCollection = window.myCollection.concat(data.skivor); 
        currentPage = page;

        if (!searchTerm) {
            statusDiv.innerHTML = `<p style="color: #51cf66; font-weight: bold; margin-bottom: 15px;">Visar ${window.myCollection.length} av totalt ${data.totalt_i_samlingen} skivor i din databas.</p>`;
        } else {
            statusDiv.innerHTML = `<p style="color: #666; margin-bottom: 15px;">Hittade ${data.totalt_i_samlingen} träffar för "${searchTerm}".</p>`;
        }
        
        document.getElementById('search-container').style.display = 'block';
        renderCollection(data.skivor, page > 1);

        if (data.pagination && data.pagination.pages > page) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.innerText = 'Ladda nästa 25 skivor';
        } else {
            if(loadMoreBtn) loadMoreBtn.style.display = 'none';
        }

    } catch (error) {
        statusDiv.innerHTML = `<p style="color: #ff4757; font-weight: bold;">Fel: ${error.message}</p>`;
        if (loadMoreBtn && page > 1) loadMoreBtn.innerText = 'Ladda nästa 25 skivor';
    }
    
    isLoading = false;
}

function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        fetchCollection(1);
    }, 500);
}

function renderCollection(skivor, append = false) {
    const listDiv = document.getElementById('collection-list');
    
    if (!append) {
        listDiv.innerHTML = ''; 
    }

    const settings = JSON.parse(localStorage.getItem('tradeogs_display')) || { 
        bild: true, format: true, ar: true, bolag: false, genre: true, 
        tracklist: true, katalog: true, url: true, price: true 
    };

    if (skivor.length === 0 && !append) {
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
        
        // Observera att vi nu använder release_id istället för id för Discogs-anropen
        const discogsId = skiva.release_id; 

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
                <button class="btn btn-tradera" onclick="event.stopPropagation(); alert('Skapar annons för ID: ${discogsId}')" style="margin: 0; padding: 8px 15px; font-size: 14px; width: auto;">Sälj på Tradera</button>
            </div>
        `;

        const detailsRow = document.createElement('div');
        detailsRow.style.cssText = "display: none; padding: 20px; border-top: 1px solid #eee; background-color: #fafafa;";
        
        const storBild = skiva.bild ? `<img src="${skiva.bild}" style="width: 120px; height: 120px; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-right: 20px; object-fit: cover;">` : '';

        let tabellRader = `
            <tr style="border-bottom: 1px solid #e1e4e8;">
                <th style="padding: 8px 0; color: #666; font-weight: normal; width: 140px;">Format:</th>
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
        
        if (settings.url) {
            tabellRader += `
            <tr style="border-bottom: 1px solid #e1e4e8;">
                <th style="padding: 8px 0; color: #666; font-weight: normal; vertical-align: top;">Länk:</th>
                <td style="padding: 8px 0;">
                    <a href="${skiva.discogs_url}" target="_blank" style="color: #4285F4; text-decoration: none; word-break: break-all;">${skiva.discogs_url}</a>
                </td>
            </tr>`;
        }

        if (settings.price) {
            tabellRader += `
            <tr style="border-bottom: 1px solid #e1e4e8;">
                <th style="padding: 8px 0; color: #666; font-weight: normal; vertical-align: top;">Marknadsvärde:</th>
                <td style="padding: 8px 0; font-weight: normal; color: #666;" id="price-${discogsId}">
                    <span style="font-style: italic;">Laddar värdering... ⏳</span>
                </td>
            </tr>`;
        }

        if (settings.tracklist) {
            tabellRader += `
            <tr>
                <th style="padding: 12px 0 8px 0; color: #666; font-weight: normal; vertical-align: top;">Låtlista:</th>
                <td style="padding: 12px 0 8px 0; font-weight: normal; color: #666;" id="tracklist-${discogsId}">
                    <span style="font-style: italic;">Laddar låtlista... ⏳</span>
                </td>
            </tr>`;
        }

        detailsRow.innerHTML = `
            <div style="display: flex; align-items: flex-start;">
                ${storBild}
                <div style="flex-grow: 1; min-width: 0;">
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

            if (isHidden && (settings.tracklist || settings.price)) {
                const tracklistTd = document.getElementById(`tracklist-${discogsId}`);
                const priceTd = document.getElementById(`price-${discogsId}`);
                
                const needsTracklist = tracklistTd && tracklistTd.innerText.includes('Laddar');
                const needsPrice = priceTd && priceTd.innerText.includes('Laddar');

                if (needsTracklist || needsPrice) {
                    const token = localStorage.getItem('discogs_token');
                    const secret = localStorage.getItem('discogs_secret');
                    
                    try {
                        const response = await fetch(`/api/discogs/release/${discogsId}?token=${token}&secret=${secret}`);
                        const data = await response.json();
                        
                        if (needsTracklist) {
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
                        }

                        if (needsPrice) {
                            if (data.prices && Object.keys(data.prices).length > 0) {
                                const p = data.prices;
                                const formatPrice = (condition) => {
                                    return p[condition] ? `<strong>${parseFloat(p[condition].value).toFixed(2)} ${p[condition].currency}</strong>` : '-';
                                };
                                
                                let priceHtml = `
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; font-size: 13px;">
                                        <div style="background: #e8f0fe; padding: 6px 10px; border-radius: 4px; color: #1a73e8;">M/NM: <br>${formatPrice('Near Mint (NM or M-)')}</div>
                                        <div style="background: #e8f0fe; padding: 6px 10px; border-radius: 4px; color: #1a73e8;">VG+: <br>${formatPrice('Very Good Plus (VG+)')}</div>
                                        <div style="background: #e8f0fe; padding: 6px 10px; border-radius: 4px; color: #1a73e8;">VG: <br>${formatPrice('Very Good (VG)')}</div>
                                        <div style="background: #e8f0fe; padding: 6px 10px; border-radius: 4px; color: #1a73e8;">G+: <br>${formatPrice('Good Plus (G+)')}</div>
                                    </div>
                                `;
                                priceTd.innerHTML = priceHtml;
                            } else {
                                priceTd.innerHTML = '<span style="color: #888;">Ingen försäljningshistorik hittades.</span>';
                            }
                        }
                    } catch (e) {
                        if (needsTracklist) tracklistTd.innerHTML = '<span style="color: #ff4757;">Kunde inte hämta låtlista.</span>';
                        if (needsPrice) priceTd.innerHTML = '<span style="color: #ff4757;">Kunde inte hämta prisvärdering.</span>';
                    }
                }
            }
        };

        item.appendChild(mainRow);
        item.appendChild(detailsRow);
        listDiv.appendChild(item);
    });
}
