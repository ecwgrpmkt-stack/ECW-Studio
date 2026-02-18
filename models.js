// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "ECW-Studio";
const MODEL_FOLDER = "models";

let models = []; 
let currentIndex = 0;
const viewer = document.querySelector("#viewer3d");

// TIMERS
let idleTimer = null;
let slideTimer = null; // 60s auto-next
const IDLE_DELAY = 3000;       // 3s for Hand Icon
const SLIDE_DELAY = 60000;     // 60s for Auto-Next

// STATE
let savedOrbit = null; // Stores {theta, phi} to persist angle

async function initShowroom() {
    const loader = document.getElementById('ecwLoader');
    if(loader) loader.classList.add('active');

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${MODEL_FOLDER}`);
        
        if (response.status === 404) throw new Error("Models folder not found.");
        if (!response.ok) throw new Error("GitHub API Error.");
        
        const files = await response.json();
        const glbFiles = files.filter(f => f.name.toLowerCase().endsWith('.glb') && !f.name.startsWith('disabled_'));

        if (glbFiles.length === 0) throw new Error("No 3D models found.");

        models = glbFiles.map(glb => {
            const baseName = glb.name.substring(0, glb.name.lastIndexOf('.'));
            const pngName = `${baseName}.png`;
            const posterFile = files.find(f => f.name === pngName);
            
            let niceName = baseName.replace(/_/g, ' ').replace(/-/g, ' ');
            niceName = niceName.replace(/\b\w/g, l => l.toUpperCase());

            return {
                src: glb.download_url,
                poster: posterFile ? posterFile.download_url : 'https://placehold.co/400x300/222/FFF.png?text=No+Preview',
                name: niceName,
                year: (niceName.match(/\d{4}/) || ["Model"])[0] 
            };
        });

        buildThumbnails();
        // Initial load without fade
        loadModelData(0);
        setupEvents();

    } catch (error) {
        console.error(error);
        if(document.getElementById('infoName')) document.getElementById('infoName').innerText = "ERROR";
    } finally {
        if(loader) setTimeout(() => loader.classList.remove('active'), 500);
        startTimers(); // Start the idle clocks
    }
}

// --- CORE LOADING LOGIC ---

// Triggers the "Fade to Black -> Switch -> Fade In" sequence
function transitionToModel(index) {
    const fadeOverlay = document.getElementById('fadeOverlay');
    const loader = document.getElementById('ecwLoader');
    
    // 1. Save current camera angle
    if (viewer) {
        const orbit = viewer.getCameraOrbit();
        savedOrbit = { theta: orbit.theta, phi: orbit.phi };
    }

    // 2. Fade Out
    fadeOverlay.classList.add('active');
    loader.classList.add('active'); // Show "ECW" spinner

    setTimeout(() => {
        // 3. Switch Data while screen is black
        currentIndex = index;
        loadModelData(currentIndex);

        // 4. Wait short buffer then fade in
        setTimeout(() => {
            fadeOverlay.classList.remove('active');
            loader.classList.remove('active');
            updateThumbs();
            resetTimers(); // Reset 60s timer
        }, 800); 

    }, 500); // Wait 500ms for fade to black
}

function loadModelData(index) {
    if (!models[index]) return;
    const data = models[index];
    
    document.getElementById('infoName').innerText = data.name;
    document.getElementById('infoYear').innerText = data.year;

    if(viewer) {
        viewer.poster = data.poster; 
        viewer.src = data.src;
        viewer.alt = `3D Model of ${data.name}`;
        
        // APPLY SAVED ORBIT (Persistence)
        if (savedOrbit) {
            viewer.cameraOrbit = `${savedOrbit.theta}rad ${savedOrbit.phi}rad auto`;
        } else {
            viewer.cameraOrbit = "auto auto auto";
        }

        // Always Auto-Rotate on load
        viewer.autoRotate = true; 
    }
    updateThumbs();
}

function buildThumbnails() {
    const panel = document.getElementById("thumbPanel");
    if(!panel) return;
    panel.innerHTML = "";
    
    models.forEach((item, i) => {
        const thumb = document.createElement("img");
        thumb.src = item.poster; 
        thumb.className = "thumb";
        thumb.onclick = () => transitionToModel(i);
        panel.appendChild(thumb);
    });
}

function updateThumbs() {
    document.querySelectorAll(".thumb").forEach((t, i) => {
        t.classList.toggle("active", i === currentIndex);
        if(i === currentIndex) t.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
}

// --- INTERACTION & TIMERS ---

function setupEvents() {
    document.getElementById("prevBtn").onclick = () => {
        let newIndex = (currentIndex - 1 + models.length) % models.length;
        transitionToModel(newIndex);
    };
    document.getElementById("nextBtn").onclick = () => {
        let newIndex = (currentIndex + 1) % models.length;
        transitionToModel(newIndex);
    };
    document.getElementById("fsBtn").onclick = () => {
        const app = document.getElementById("app");
        !document.fullscreenElement ? app.requestFullscreen() : document.exitFullscreen();
    };

    if(viewer) {
        // User interacts -> Stop rotation -> Reset Timers
        viewer.addEventListener('camera-change', (e) => {
            if (e.detail.source === 'user-interaction') {
                viewer.autoRotate = false;
                document.getElementById('idleIndicator').classList.remove('visible');
                resetTimers(); // User is active, restart 60s count
            }
        });
    }
}

function startTimers() {
    // 3s Timer for Hand Icon + AutoRotate
    idleTimer = setTimeout(() => {
        if(viewer) viewer.autoRotate = true;
        document.getElementById('idleIndicator').classList.add('visible');
    }, IDLE_DELAY);

    // 60s Timer for Auto-Next Slide
    slideTimer = setTimeout(() => {
        let nextIndex = (currentIndex + 1) % models.length;
        transitionToModel(nextIndex);
    }, SLIDE_DELAY);
}

function resetTimers() {
    clearTimeout(idleTimer);
    clearTimeout(slideTimer);
    startTimers();
}

// Start
initShowroom();
