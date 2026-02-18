// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "360_gallery";
const MODEL_FOLDER = "models"; // Must match Admin folder

let models = []; 
let currentIndex = 0;
const viewer = document.querySelector("#viewer3d");
let idleTimer = null;
const IDLE_DELAY = 3000;

// --- 1. INIT ---
async function initShowroom() {
    const loader = document.getElementById('ecwLoader');
    loader.classList.add('active');

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${MODEL_FOLDER}`);
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const files = await response.json();

        // 1. Find all GLB files
        const glbFiles = files.filter(f => f.name.toLowerCase().endsWith('.glb') && !f.name.startsWith('disabled_'));

        if (glbFiles.length === 0) throw new Error("No visible 3D models found.");

        // 2. Map to Objects (Linking GLB with matching PNG)
        models = glbFiles.map(glb => {
            const baseName = glb.name.substring(0, glb.name.lastIndexOf('.'));
            const pngName = `${baseName}.png`;
            
            // Find matching PNG in the file list
            const posterFile = files.find(f => f.name === pngName);
            
            // Format Display Name "2024_Toyota-Camry" -> "Toyota Camry"
            let niceName = baseName.replace(/_/g, ' ').replace(/-/g, ' ');
            let year = "----";
            
            // Simple logic: If starts with number, assume year
            const parts = niceName.split(' ');
            if (!isNaN(parts[0])) {
                year = parts[0];
                niceName = parts.slice(1).join(' ');
            }

            return {
                src: glb.download_url,
                // Fallback to a placeholder if no PNG upload found
                poster: posterFile ? posterFile.download_url : 'https://placehold.co/400x300/222/FFF.png?text=No+Preview',
                name: niceName,
                year: year
            };
        });

        // 3. Sort Alphabetically
        models.sort((a, b) => a.year.localeCompare(b.year));

        // 4. Build UI
        buildThumbnails();
        loadModel(0);
        setupEvents();

    } catch (error) {
        console.error(error);
        document.getElementById('infoName').innerText = "System Error";
        document.getElementById('infoModel').innerText = "Check Console";
    } finally {
        setTimeout(() => loader.classList.remove('active'), 500);
    }
}

// --- 2. LOAD MODEL ---
function loadModel(index) {
    if (!models[index]) return;
    const data = models[index];
    
    // Text Info
    document.getElementById('infoName').innerText = data.name;
    document.getElementById('infoYear').innerText = data.year;
    
    // Viewer Logic
    // IMPORTANT: Set poster *before* src to ensure smooth loading
    viewer.poster = data.poster; 
    viewer.src = data.src;
    viewer.alt = `3D Model of ${data.name}`;
    
    // Force reset rotation
    viewer.autoRotate = true; 
    
    updateThumbs();
    resetIdleTimer();
}

// --- 3. UI ---
function buildThumbnails() {
    const panel = document.getElementById("thumbPanel");
    panel.innerHTML = "";
    
    models.forEach((item, i) => {
        const thumb = document.createElement("img");
        thumb.src = item.poster;
        thumb.className = "thumb";
        thumb.onclick = () => {
            currentIndex = i;
            loadModel(currentIndex);
        };
        panel.appendChild(thumb);
    });
}

function updateThumbs() {
    document.querySelectorAll(".thumb").forEach((t, i) => {
        t.classList.toggle("active", i === currentIndex);
        if(i === currentIndex) t.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

// --- 4. EVENTS ---
function setupEvents() {
    // Nav
    document.getElementById("prevBtn").onclick = () => {
        currentIndex = (currentIndex - 1 + models.length) % models.length;
        loadModel(currentIndex);
    };
    document.getElementById("nextBtn").onclick = () => {
        currentIndex = (currentIndex + 1) % models.length;
        loadModel(currentIndex);
    };
    document.getElementById("fsBtn").onclick = () => {
        const app = document.getElementById("app");
        if (!document.fullscreenElement) app.requestFullscreen();
        else document.exitFullscreen();
    };

    // Auto-Rotate Handling
    viewer.addEventListener('camera-change', (e) => {
        // Only stop if user is actually interacting
        if (e.detail.source === 'user-interaction') {
            stopAutoRotate();
        }
    });
}

function stopAutoRotate() {
    viewer.autoRotate = false;
    document.getElementById('idleIndicator').classList.remove('visible');
    
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        viewer.autoRotate = true; // Resume
        // Optional: Show "hand" icon again? 
        // document.getElementById('idleIndicator').classList.add('visible');
    }, IDLE_DELAY);
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    viewer.autoRotate = true;
}

// Start
initShowroom();
