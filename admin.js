// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "360_gallery";

// STATE
let currentFolder = "images"; // 'images' or 'models'

// --- 1. AUTH & INIT ---
if (sessionStorage.getItem('ecw_auth') !== 'true') window.location.href = 'index.html';
function logout() { sessionStorage.removeItem('ecw_auth'); window.location.href = 'index.html'; }

// --- 2. TABS & CONTEXT SWITCHING ---
function switchContext(folder) {
    currentFolder = folder;
    
    // Update UI
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active'); // Assumes onclick passes event, or logic handles it
    
    const isModel = folder === 'models';
    document.getElementById('uploadTitle').innerText = isModel ? "Upload 3D Models & Posters" : "Upload 360 Images";
    document.getElementById('listTitle').innerText = isModel ? "3D Assets Repository" : "360 Gallery Repository";
    document.getElementById('uploadHint').innerText = isModel ? "Supported: .GLB (Model), .PNG (Poster/Thumbnail)" : "Supported: .JPG, .PNG";
    
    // Update Input Accept Attribute
    document.getElementById('fileInput').accept = isModel ? ".glb, .png, .jpg, .jpeg" : ".jpg, .jpeg, .png";
    
    // Update Repo Display
    document.getElementById('repoUrl').value = `/${folder}`;
    
    loadFiles();
}

// --- 3. SMART TOKEN LOCK LOGIC ---
const tokenInput = document.getElementById('githubToken');
const tokenLockBtn = document.getElementById('tokenLockBtn');
let isTokenLocked = true; 
const savedToken = localStorage.getItem('ecw_gh_token');

if (savedToken) { tokenInput.value = savedToken; lockTokenField(); } 
else { unlockTokenField(); }

function unlockTokenField() {
    tokenInput.readOnly = false; tokenInput.disabled = false; tokenInput.type = 'text';         
    tokenInput.style.backgroundColor = "rgba(0,0,0,0.2)"; tokenInput.style.color = "#ffffff";
    tokenLockBtn.innerText = '🔓'; tokenLockBtn.title = 'Lock & Save'; isTokenLocked = false;
}
function lockTokenField() {
    tokenInput.readOnly = true; tokenInput.type = 'password';     
    tokenInput.style.backgroundColor = "rgba(0,0,0,0.6)"; tokenInput.style.color = "#888888";
    tokenLockBtn.innerText = '🔒'; tokenLockBtn.title = 'Unlock to Edit'; isTokenLocked = true;
    if (tokenInput.value.trim() !== '') localStorage.setItem('ecw_gh_token', tokenInput.value.trim());
}
tokenLockBtn.addEventListener('click', () => isTokenLocked ? (unlockTokenField(), tokenInput.focus()) : lockTokenField());

// --- 4. DATA FETCHING ---
async function loadFiles() {
    const tableBody = document.getElementById('fileTableBody');
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Fetching ${currentFolder}...</td></tr>`;
    
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${currentFolder}?t=${Date.now()}`);
        if (!response.ok) {
            if(response.status === 404) throw new Error(`Folder '${currentFolder}' not created yet.`);
            throw new Error("API Error. Check Rate Limits/Token.");
        }
        
        const data = await response.json();
        // Filter based on context
        const files = data.filter(file => {
            if (currentFolder === 'images') return file.name.match(/\.(jpg|jpeg|png)$/i);
            if (currentFolder === 'models') return file.name.match(/\.(glb|gltf|png|jpg)$/i);
            return false;
        });

        tableBody.innerHTML = ""; 
        for (const file of files) {
            const row = document.createElement('tr');
            row.id = `row-${file.sha}`; 
            row.innerHTML = buildRowHTML(file);
            tableBody.appendChild(row);
        }
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">${error.message}</td></tr>`;
    }
}

function buildRowHTML(file) {
    const isDisabled = file.name.startsWith("disabled_");
    const cleanName = isDisabled ? file.name.replace("disabled_", "") : file.name;
    const statusBadge = isDisabled ? `<span class="badge warning">Hidden</span>` : `<span class="badge success">Live</span>`;
    const safeName = file.name.replace(/'/g, "\\'");
    
    // Determine Icon/Preview
    let preview = "";
    if (file.name.match(/\.(jpg|png|jpeg)$/i)) {
        preview = `<img src="${file.download_url}" class="admin-thumb" style="opacity: ${isDisabled ? 0.5 : 1}">`;
    } else if (file.name.match(/\.glb$/i)) {
        preview = `<div class="file-icon-box">📦 3D</div>`;
    }

    return `
        <td>${preview}</td>
        <td style="color: ${isDisabled ? '#888' : '#fff'}">${cleanName}</td>
        <td class="dim-cell">${(file.size / 1024).toFixed(1)} KB</td>
        <td>${statusBadge}</td>
        <td>
            <div class="action-buttons">
                <button onclick="openRenameModal('${safeName}', '${file.sha}', '${file.download_url}')" class="btn-mini btn-blue" title="Rename">✎</button>
                <button onclick="toggleVisibility('${safeName}', '${file.sha}', '${file.download_url}')" class="btn-mini btn-yellow" title="${isDisabled ? 'Show' : 'Hide'}">${isDisabled ? '👁️' : '🚫'}</button>
                <button onclick="openDeleteModal('${safeName}', '${file.sha}')" class="btn-mini btn-red" title="Delete">🗑️</button>
            </div>
        </td>
    `;
}

// --- 5. GITHUB API HELPER ---
async function githubRequest(endpoint, method = 'GET', body = null) {
    const rawToken = document.getElementById('githubToken').value.trim();
    if (!rawToken) { if(isTokenLocked) unlockTokenField(); tokenInput.focus(); throw new Error("Token missing."); }
    
    const options = {
        method: method,
        headers: { 
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${rawToken}`, 
            'X-GitHub-Api-Version': '2022-11-28'
        }
    };
    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/${endpoint}`, options);
    if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
    return response;
}

// --- 6. MODALS (Simplified for brevity, logic identical to original) ---
const modal = document.getElementById('customModal');
function closeModal() { modal.classList.remove('active'); }

function openDeleteModal(filename, sha) {
    document.getElementById('modalTitle').innerText = "Delete Asset";
    document.getElementById('modalBody').innerHTML = `<p>Delete <strong>${filename}</strong>?</p>`;
    document.getElementById('modalFooter').innerHTML = `
        <button class="modal-btn btn-cancel" onclick="closeModal()">Cancel</button>
        <button class="modal-btn btn-confirm" onclick="executeDelete('${filename}', '${sha}')">Delete</button>`;
    modal.classList.add('active');
}

async function executeDelete(filename, sha) {
    try {
        await githubRequest(`contents/${currentFolder}/${encodeURIComponent(filename)}`, 'DELETE', { message: `Delete ${filename}`, sha: sha });
        document.getElementById(`row-${sha}`).remove(); closeModal();
    } catch(e) { alert(e.message); }
}

function openRenameModal(oldName, sha, downloadUrl) {
    // ... (Same rename logic as original, just using currentFolder variable) ...
    // Note: For brevity in this prompt, assume standard rename logic using currentFolder
    // Implementation is identical to previous admin.js but uses `contents/${currentFolder}/...`
    const lastDot = oldName.lastIndexOf('.');
    const baseName = oldName.substring(0, lastDot);
    const ext = oldName.substring(lastDot);
    
    document.getElementById('modalTitle').innerText = "Rename Asset";
    document.getElementById('modalBody').innerHTML = `
        <label>New Filename</label>
        <div class="rename-input-group"><input type="text" id="renameBaseInput" value="${baseName}"><span class="rename-ext">${ext}</span></div>`;
    document.getElementById('modalFooter').innerHTML = `
        <button class="modal-btn btn-cancel" onclick="closeModal()">Cancel</button>
        <button class="modal-btn btn-save" onclick="executeRename('${oldName}', '${ext}', '${sha}', '${downloadUrl}')">Save</button>`;
    modal.classList.add('active');
}

async function executeRename(oldName, ext, sha, downloadUrl) {
    const newName = document.getElementById('renameBaseInput').value.trim().replace(/[^a-zA-Z0-9.\-_]/g, '_') + ext;
    if(newName === oldName) { closeModal(); return; }
    await performRename(oldName, newName, sha, downloadUrl);
}

async function toggleVisibility(filename, sha, downloadUrl) {
    const isHidden = filename.startsWith("disabled_");
    const newName = isHidden ? filename.replace("disabled_", "") : `disabled_${filename}`;
    await performRename(filename, newName, sha, downloadUrl);
}

async function performRename(oldName, newName, oldSha, downloadUrl) {
    // Standard Git Rename: GET Blob -> PUT New -> DELETE Old
    try {
        const blobRes = await fetch(downloadUrl);
        const blob = await blobRes.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const b64 = reader.result.split(',')[1];
            await githubRequest(`contents/${currentFolder}/${encodeURIComponent(newName)}`, 'PUT', { message: `Rename`, content: b64 });
            await githubRequest(`contents/${currentFolder}/${encodeURIComponent(oldName)}`, 'DELETE', { message: `Cleanup`, sha: oldSha });
            closeModal(); loadFiles();
        };
    } catch(e) { alert("Rename Failed: " + e.message); }
}

// --- 7. UPLOAD LOGIC ---
document.getElementById('fileInput').addEventListener('change', async function() {
    const files = Array.from(this.files);
    if(files.length === 0) return;
    
    const statusMsg = document.getElementById('uploadStatus');
    
    for (const file of files) {
        statusMsg.innerHTML = `<span style="color:orange">Uploading ${file.name}...</span>`;
        // 50MB Limit for 3D files, 25MB for images
        const limit = file.name.endsWith('.glb') ? 50 : 25;
        if (file.size / (1024 * 1024) > limit) {
             alert(`File ${file.name} too large (Max ${limit}MB)`); continue; 
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async function() {
            const content = reader.result.split(',')[1];
            try {
                // Check if exists to get SHA (for overwrite)
                let sha = null;
                try {
                    const check = await githubRequest(`contents/${currentFolder}/${encodeURIComponent(file.name)}`, 'GET');
                    const json = await check.json();
                    sha = json.sha;
                } catch(e) {}

                const body = { message: `Upload ${file.name}`, content: content };
                if(sha) body.sha = sha;

                await githubRequest(`contents/${currentFolder}/${encodeURIComponent(file.name)}`, 'PUT', body);
            } catch(e) { console.error(e); }
        };
    }
    
    // Wait a bit then refresh
    setTimeout(() => {
        statusMsg.innerHTML = `<span style="color:#00ff00">Batch Processed!</span>`;
        loadFiles();
    }, 2000 * files.length); // Rough estimate wait
});

// Start
loadFiles();
