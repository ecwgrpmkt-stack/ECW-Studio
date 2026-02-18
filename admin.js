// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "ECW-Studio"; // FIXED
const IMAGE_FOLDER = "images";

// --- 1. AUTH & INIT ---
if (sessionStorage.getItem('ecw_auth') !== 'true') window.location.href = 'index.html';
function logout() { sessionStorage.removeItem('ecw_auth'); window.location.href = 'index.html'; }

// --- 2. TABS & CONTEXT ---
let currentFolder = "images"; 

function switchContext(folder) {
    currentFolder = folder;
    // Update Repo Display
    document.getElementById('repoUrl').value = `/${folder}`;
    loadFiles();
}

// --- 3. LOAD FILES ---
async function loadFiles() {
    const tableBody = document.getElementById('imageTableBody'); // Reusing ID for simplicity
    if(!tableBody) return;
    
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Fetching /${currentFolder}...</td></tr>`;
    
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${currentFolder}?t=${Date.now()}`);
        
        if (response.status === 404) {
             tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:orange;">Folder '/${currentFolder}' not found.<br>Upload a file to create it.</td></tr>`;
             return;
        }
        
        const data = await response.json();
        
        // Filter based on active tab
        const files = data.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            if (currentFolder === 'images') return ['jpg', 'jpeg', 'png'].includes(ext);
            if (currentFolder === 'models') return ['glb', 'gltf', 'png'].includes(ext);
            return false;
        });

        tableBody.innerHTML = ""; 
        for (const file of files) {
            const row = document.createElement('tr');
            row.innerHTML = buildRowHTML(file);
            tableBody.appendChild(row);
        }
        if(files.length === 0) tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No files found.</td></tr>`;

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">${error.message}</td></tr>`;
    }
}

function buildRowHTML(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    let preview = "";
    
    if (['jpg','jpeg','png'].includes(ext)) {
        preview = `<img src="${file.download_url}" class="admin-thumb" style="width:50px;">`;
    } else {
        preview = `<div style="background:#333; padding:5px; font-size:10px; text-align:center;">📦 3D</div>`;
    }

    return `
        <td>${preview}</td>
        <td>${file.name}</td>
        <td class="dim-cell">${(file.size/1024).toFixed(1)} KB</td>
        <td><span class="badge success">Live</span></td>
        <td><button class="btn-mini btn-red" onclick="alert('Use Delete API')">🗑️</button></td>
    `;
}

// Initialize
// Make sure to add the tabs to admin.html if not present, otherwise this defaults to images
loadFiles();
