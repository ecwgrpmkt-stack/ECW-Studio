// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "360_gallery";
const MODEL_FOLDER = "models"; // Matches Admin folder

let models = []; 
let currentIndex = 0;
const viewer = document.querySelector("#viewer3d");
let idleTimer = null;
const IDLE_DELAY = 3000;

async function initShowroom() {
    const loader = document.getElementById('ecwLoader');
    loader.classList.add('active');

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${MODEL_FOLDER}`);
        
        // FIX: Handle Missing Folder Gracefully
        if (response.status === 404) {
            throw new Error("No 'models' folder found. Please upload models via Admin.");
        }
        
        if (!response.ok) throw new Error("API Error. Check Network.");
        const files = await response.json();

        // 1. Find GLB files
        const glbFiles = files.filter(f => f.name.toLowerCase().endsWith('.glb') && !f.name.startsWith('disabled_'));

        if (glbFiles.length === 0) throw new Error("No 3D models available.");

        // 2. Link GLB + PNG
        models = glbFiles.map(glb => {
            const baseName = glb.name.substring(0, glb.name.lastIndexOf('.'));
            const pngName = `${baseName}.png`;
            const posterFile = files.find(f => f.name === pngName);
            
            // Name Formatting
            let niceName = baseName.replace(/_/g, ' ').replace(/-/g, ' ');
            let year = "Model";
            const parts = niceName.split(' ');
            if (!isNaN(parts[0])) { year = parts[0]; niceName = parts.slice(1).join(' '); }

            return {
                src: glb.download_url,
                poster: posterFile ? posterFile.download_url : 'https://placehold.co/400x300/222/FFF.png?text=No+Preview',
                name: niceName,
                year: year
            };
        });

        // 3. Sort & Build
        models.sort((a, b) => a.year.localeCompare(b.year));
        buildThumbnails();
        loadModel(0);
        setupEvents();

    } catch (error) {
        console.warn(error);
        document.getElementById('infoName').innerText = "System Info";
        document.getElementById('infoModel').innerText = error.message;
        document.getElementById('infoYear').innerText = "⚠️";
    } finally {
        setTimeout(() => loader.classList.remove('active'), 500);
    }
}

function loadModel(index) {
    if (!models[index]) return;
    const data = models[index];
    
    document.getElementById('infoName').innerText = data.name;
    document.getElementById('infoYear').innerText = data.year;
    document.getElementById('infoModel').innerText = "Exterior";

    viewer.poster = data.poster; 
    viewer.src = data.src;
    viewer.alt = `3D Model of ${data.name}`;
    viewer.autoRotate = true; 
    
    updateThumbs();
    resetIdleTimer();
}

function buildThumbnails() {
    const panel = document.getElementById("thumbPanel");
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
        !document.fullscreenElement ? app.requestFullscreen() : document.exitFullscreen();
    };

    viewer.addEventListener('camera-change', (e) => {
        if (e.detail.source === 'user-interaction') stopAutoRotate();
    });
}

function stopAutoRotate() {
    viewer.autoRotate = false;
    document.getElementById('idleIndicator').classList.remove('visible');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { viewer.autoRotate = true; }, IDLE_DELAY);
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    viewer.autoRotate = true;
}

initShowroom();
