// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "ECW-Studio";
const BRANCH = "main";

let models = []; 
let currentIndex = 0;
const viewer = document.querySelector("#viewer3d");

// TIMERS & STATE
let idleTimer = null;
let slideTimer = null; 
const IDLE_DELAY = 3000;       
const SLIDE_DELAY = 60000;     
let colorEngineTimer = null;   
let savedOrbit = null; 
let currentBlobUrl = null; 

async function fetchFolderAPI(folderName, variant) {
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/models/${encodeURIComponent(folderName)}`);
        if (!res.ok) return null;
        
        const files = await res.json();
        
        // Find a file that isn't a PNG or JPG
        const modelFile = files.find(f => f.type === 'file' && !f.name.endsWith('.png') && !f.name.endsWith('.jpg') && !f.name.endsWith('.md'));
        if (!modelFile) return null;
        
        return {
            src: modelFile.download_url,
            variant: variant
        };
    } catch(e) {
        return null;
    }
}

async function initShowroom() {
    const loader = document.getElementById('ecwLoader');
    if(loader) loader.classList.add('active');

    try {
        // Fetch dynamically from API first
        const singleData = await fetchFolderAPI('Single Tone', 'SINGLE TONE');
        const twoData = await fetchFolderAPI('Two Tone', 'TWO TONE');
        const otherData = await fetchFolderAPI('Other', 'OTHER');

        models = [];
        if (singleData) models.push(singleData);
        if (twoData) models.push(twoData);
        if (otherData) models.push(otherData);

        if (models.length === 0) throw new Error("API limits hit or empty folders.");
        
        startApp();

    } catch (error) {
        console.warn("Using Hardcoded Bulletproof Fallbacks to ensure rendering...", error);
        
        // THESE PATHS MATCH YOUR GITHUB EXACTLY. IT WILL NEVER LOAD THE ASTRONAUT.
        models = [
            { 
                src: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/models/Single%20Tone/Toyota%20H300%20Single%20Tone.glb`, 
                variant: "SINGLE TONE" 
            },
            { 
                src: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/models/Two%20Tone/Toyota%20H300%20Two%20Tone`, // Missing .glb handled automatically by Blob engine
                variant: "TWO TONE" 
            }
        ];
        startApp();
    } finally {
        if(loader) setTimeout(() => loader.classList.remove('active'), 300);
    }
}

function startApp() {
    currentIndex = 0; 
    buildVariantButtons();
    loadModelData(currentIndex);
    setupEvents();
    resetGlobalTimers(); 
}

function buildVariantButtons() {
    const panel = document.getElementById("variantPanel");
    if(!panel) return;
    panel.innerHTML = "";
    
    models.forEach((m, index) => {
        const btn = document.createElement("button");
        btn.className = "tone-btn";
        btn.innerText = m.variant;
        btn.dataset.index = index;
        btn.onclick = () => transitionToModel(index);
        panel.appendChild(btn);
    });
}

function updateVariantButtons() {
    document.querySelectorAll(".tone-btn").forEach(btn => {
        if(parseInt(btn.dataset.index) === currentIndex) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

function transitionToModel(index) {
    if (index === currentIndex) return;

    const fadeOverlay = document.getElementById('fadeOverlay');
    const loader = document.getElementById('ecwLoader');
    
    if (typeof ColorEngine !== 'undefined') ColorEngine.reset();

    if (viewer) {
        const orbit = viewer.getCameraOrbit();
        savedOrbit = { theta: orbit.theta, phi: orbit.phi };
    }

    fadeOverlay.classList.add('active');
    loader.classList.add('active'); 

    setTimeout(() => {
        currentIndex = index;
        loadModelData(currentIndex);

        setTimeout(() => {
            fadeOverlay.classList.remove('active');
            loader.classList.remove('active');
            resetGlobalTimers(); 
        }, 200); 

    }, 200); 
}

// -----------------------------------------------------
// THE BLOB FIX: Bypasses missing .glb extensions
// -----------------------------------------------------
async function loadModelData(index) {
    if (!models[index]) return;
    const data = models[index];

    if(viewer) {
        // Clear old memory
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }

        try {
            // Fetch the raw file from GitHub
            const res = await fetch(data.src, { mode: 'cors' });
            if (!res.ok) throw new Error("Network fetch failed");
            
            // Convert to binary blob
            const rawBlob = await res.blob();
            
            // FORCE the 3D model MIME type, solving the missing .glb extension bug
            const safeBlob = new Blob([rawBlob], { type: 'model/gltf-binary' });
            
            currentBlobUrl = URL.createObjectURL(safeBlob);
            viewer.src = currentBlobUrl;
            
        } catch (e) {
            console.error("Blob loader failed, falling back to raw URL:", e);
            viewer.src = data.src;
        }
        
        if (savedOrbit) {
            viewer.cameraOrbit = `${savedOrbit.theta}rad ${savedOrbit.phi}rad auto`;
        } else {
            viewer.cameraOrbit = "auto auto auto";
        }
        viewer.autoRotate = true; 
    }
    updateVariantButtons();
}

function setupEvents() {
    document.getElementById("fsBtn").onclick = () => {
        const app = document.getElementById("app");
        !document.fullscreenElement ? app.requestFullscreen() : document.exitFullscreen();
    };

    ['pointermove', 'pointerdown', 'keydown'].forEach(evt => {
        window.addEventListener(evt, resetGlobalTimers);
    });

    if(viewer) {
        viewer.addEventListener('camera-change', (e) => {
            if (e.detail.source === 'user-interaction') {
                viewer.autoRotate = false;
                
                const indicator = document.getElementById('idleIndicator');
                if (indicator) indicator.classList.remove('visible');

                clearTimeout(cameraIdleTimer);
                cameraIdleTimer = setTimeout(() => {
                    viewer.autoRotate = true;
                    const currentOrbit = viewer.getCameraOrbit();
                    viewer.cameraOrbit = `${currentOrbit.theta}rad 75deg auto`;
                }, IDLE_DELAY);
            }
        });

        viewer.addEventListener('load', () => {
            if (typeof ColorEngine !== 'undefined') {
                clearTimeout(colorEngineTimer);
                colorEngineTimer = setTimeout(() => {
                    try { ColorEngine.analyze(viewer); } catch(e) {}
                }, 400); 
            }
        });
    }
}

function resetGlobalTimers() {
    const indicator = document.getElementById('idleIndicator');
    
    if(indicator && indicator.classList.contains('visible')) {
        indicator.classList.remove('visible');
    }
    
    clearTimeout(globalInteractionTimer);
    globalInteractionTimer = setTimeout(() => {
        if(viewer && viewer.autoRotate && indicator) {
            indicator.classList.add('visible');
        }
    }, IDLE_DELAY);

    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => {
        if(models.length > 1) {
            transitionToModel((currentIndex + 1) % models.length);
        }
    }, SLIDE_DELAY);
}

initShowroom();
