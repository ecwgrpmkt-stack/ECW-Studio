// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "ECW-Studio"; // UPDATED: Matches your screenshot
const MODEL_FOLDER = "models";

let models = []; 
let currentIndex = 0;
const viewer = document.querySelector("#viewer3d");
let idleTimer = null;
const IDLE_DELAY = 3000;

async function initShowroom() {
    const loader = document.getElementById('ecwLoader');
    if(loader) loader.classList.add('active');

    try {
        // Fetch from the correct repo
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${MODEL_FOLDER}`);
        
        if (response.status === 404) {
            throw new Error(`Folder '${MODEL_FOLDER}' not found in repo '${REPO_NAME}'.`);
        }
        
        if (!response.ok) throw new Error("API Error. Check Network/Rate Limits.");
        const files = await response.json();

        // 1. Find GLB files
        const glbFiles = files.filter(f => f.name.toLowerCase().endsWith('.glb') && !f.name.startsWith('disabled_'));

        if (glbFiles.length === 0) throw new Error("No 3D models (.glb) found in folder.");

        // 2. Link GLB + PNG
        models = glbFiles.map(glb => {
            const baseName = glb.name.substring(0, glb.name.lastIndexOf('.'));
            const pngName = `${baseName}.png`;
            const posterFile = files.find(f => f.name === pngName);
            
            // Name Formatting "ford_mustang_1965" -> "Ford Mustang 1965"
            let niceName = baseName.replace(/_/g, ' ').replace(/-/g, ' ');
            // Capitalize Words
            niceName = niceName.replace(/\b\w/g, l => l.toUpperCase());

            return {
                src: glb.download_url,
                poster: posterFile ? posterFile.download_url : 'https://placehold.co/400x300/222/FFF.png?text=No+Preview',
                name: niceName,
                // Extract year if it exists in the filename (e.g. 1965)
                year: (niceName.match(/\d{4}/) || ["Model"])[0] 
            };
        });

        // 3. Build UI
        buildThumbnails();
        loadModel(0);
        setupEvents();

    } catch (error) {
        console.error(error);
        const infoName = document.getElementById('infoName');
        const infoModel = document.getElementById('infoModel');
        if(infoName) infoName.innerText = "System Error";
        if(infoModel) infoModel.innerText = error.message;
    } finally {
        if(loader) setTimeout(() => loader.classList.remove('active'), 500);
    }
}

function loadModel(index) {
    if (!models[index]) return;
    const data = models[index];
    
    document.getElementById('infoName').innerText = data.name;
    document.getElementById('infoYear').innerText = data.year;
    document.getElementById('infoModel').innerText = "Exterior";

    // Set Viewer Attributes
    if(viewer) {
        viewer.poster = data.poster; 
        viewer.src = data.src;
        viewer.alt = `3D Model of ${data.name}`;
        viewer.autoRotate = true; 
    }
    
    updateThumbs();
    resetIdleTimer();
}

function buildThumbnails() {
    const panel = document.getElementById("thumbPanel");
    if(!panel) return;
    panel.innerHTML = "";
    
    models.forEach((item, i) => {
        const thumb = document.createElement("img");
        thumb.src = item.poster;
        thumb.className = "thumb";
        thumb.onclick = () => { currentIndex = i; loadModel(currentIndex); };
        panel.appendChild(thumb);
    });
}

function updateThumbs() {
    document.querySelectorAll(".thumb").forEach((t, i) => {
        t.classList.toggle("active", i === currentIndex);
        if(i === currentIndex) t.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

function setupEvents() {
    const prev = document.getElementById("prevBtn");
    const next = document.getElementById("nextBtn");
    const fs = document.getElementById("fsBtn");

    if(prev) prev.onclick = () => {
        currentIndex = (currentIndex - 1 + models.length) % models.length;
        loadModel(currentIndex);
    };
    if(next) next.onclick = () => {
        currentIndex = (currentIndex + 1) % models.length;
        loadModel(currentIndex);
    };
    if(fs) fs.onclick = () => {
        const app = document.getElementById("app");
        !document.fullscreenElement ? app.requestFullscreen() : document.exitFullscreen();
    };

    if(viewer) {
        viewer.addEventListener('camera-change', (e) => {
            if (e.detail.source === 'user-interaction') stopAutoRotate();
        });
    }
}

function stopAutoRotate() {
    if(!viewer) return;
    viewer.autoRotate = false;
    const idle = document.getElementById('idleIndicator');
    if(idle) idle.classList.remove('visible');
    
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { viewer.autoRotate = true; }, IDLE_DELAY);
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    if(viewer) viewer.autoRotate = true;
}

// Start
initShowroom();
