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

async function initShowroom() {
    const loader = document.getElementById('ecwLoader');
    if(loader) loader.classList.add('active');

    try {
        // 1. Fetch the entire repo structure in a single API call to save limits
        const treeUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`;
        const response = await fetch(treeUrl);
        
        if (!response.ok) throw new Error("GitHub API Rate Limit Hit.");
        
        const data = await response.json();
        
        // Filter out only files inside the 'models' folder
        const modelFiles = data.tree.filter(item => item.path.startsWith('models/') && item.type === 'blob');

        // 2. HELPER: Grab whatever file is inside the target folder
        const getModelFromFolder = (folderName, variantName) => {
            const folderPrefix = `models/${folderName}/`;
            
            // Find any file in this folder that is NOT an image or text file
            const modelItem = modelFiles.find(f => 
                f.path.startsWith(folderPrefix) && 
                !f.path.endsWith('.png') && 
                !f.path.endsWith('.jpg') &&
                !f.path.endsWith('.md')
            );
            
            if (!modelItem) return null; // Folder is empty or missing

            // Find a preview image if one exists in the same folder
            const posterItem = modelFiles.find(f => f.path.startsWith(folderPrefix) && (f.path.endsWith('.png') || f.path.endsWith('.jpg')));

            return {
                src: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${encodeURI(modelItem.path)}`,
                poster: posterItem ? `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${encodeURI(posterItem.path)}` : 'https://placehold.co/400x300/222/FFF.png?text=No+Preview',
                variant: variantName
            };
        };

        // 3. MAP EXACT FOLDERS TO BUTTONS
        models = [];
        const singleData = getModelFromFolder('Single Tone', 'Single Tone');
        const twoData = getModelFromFolder('Two Tone', 'Two Tone');
        const otherData = getModelFromFolder('Other', 'Other');

        if (singleData) models.push(singleData);
        if (twoData) models.push(twoData);
        if (otherData) models.push(otherData); // ONLY creates the 'Other' button if a file exists inside

        if (models.length === 0) throw new Error("No files found in any of the folders.");

        startApp();

    } catch (error) {
        console.warn("API Failed. Using Hardcoded Fallback to your exact Repo structure...", error);
        
        // Exact fallback matching your GitHub structure, guaranteeing it works even if API is blocked
        models = [
            {
                src: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/models/Single%20Tone/Toyota%20H300%20Single%20Tone.glb`,
                poster: "https://placehold.co/400x300/222/FFF.png?text=No+Preview",
                variant: "Single Tone"
            },
            {
                src: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/models/Two%20Tone/Toyota%20H300%20Two%20Tone`,
                poster: "https://placehold.co/400x300/222/FFF.png?text=No+Preview",
                variant: "Two Tone"
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
            preloadNextModel();
        }, 200); 

    }, 200); 
}

// -----------------------------------------------------
// THE BULLETPROOF BLOB INTERCEPTOR
// This solves the "missing .glb extension" bug perfectly.
// -----------------------------------------------------
async function loadModelData(index) {
    if (!models[index]) return;
    const data = models[index];

    if(viewer) {
        viewer.poster = data.poster; 

        // Clear previous memory to prevent browser crashes
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }

        try {
            // 1. Fetch the raw file bytes directly
            const response = await fetch(data.src, { mode: 'cors' });
            if (!response.ok) throw new Error("Failed to fetch model from GitHub");

            const arrayBuffer = await response.arrayBuffer();
            
            // 2. FORCE the 3D model MIME type. This tricks the browser into rendering
            // the file perfectly even if you uploaded it without a .glb extension!
            const safeBlob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
            currentBlobUrl = URL.createObjectURL(safeBlob);
            
            viewer.src = currentBlobUrl;

        } catch (e) {
            console.error("Blob Interceptor failed, falling back to raw URL:", e);
            // Absolute last resort
            let fallbackSrc = data.src;
            if (!fallbackSrc.toLowerCase().includes('.glb') && !fallbackSrc.toLowerCase().includes('.gltf')) {
                fallbackSrc += '#.glb';
            }
            viewer.src = fallbackSrc;
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

function preloadNextModel() {
    if (models.length > 1) {
        let nextIndex = (currentIndex + 1) % models.length;
        const nextModel = models[nextIndex];
        const img = new Image();
        img.src = nextModel.poster; // Only preloads the image to save bandwidth
    }
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
