// CONFIGURATION
const REPO_OWNER = "ecwgrpmkt-stack";
const REPO_NAME = "ECW-Studio";
const MODEL_FOLDER = "models";

let models = []; 
let currentIndex = 0;
const viewer = document.querySelector("#viewer3d");

// DECOUPLED TIMERS
let cameraIdleTimer = null;       // Handles resuming 3D rotation
let globalInteractionTimer = null; // Handles the Hand Icon visibility
let slideTimer = null;            // Handles the 60s model swap
let colorEngineTimer = null;   

const IDLE_DELAY = 3000;       
const SLIDE_DELAY = 60000;     

// STATE
let savedOrbit = null; 
let currentBlobUrl = null; 

async function initShowroom() {
    const loader = document.getElementById('ecwLoader');
    if(loader) loader.classList.add('active');

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${MODEL_FOLDER}`);
        if (!response.ok) throw new Error("GitHub API Error (Rate Limit likely).");
        
        const files = await response.json();
        const modelFiles = files.filter(f => 
            (f.name.toLowerCase().endsWith('.glb') || f.name.toLowerCase().includes('tone') || f.name.toLowerCase().includes('toyota')) 
            && !f.name.startsWith('disabled_') && !f.name.endsWith('.png')
        );

        if (modelFiles.length === 0) throw new Error("No 3D models found.");

        let tempModels = modelFiles.map(glb => {
            const baseName = glb.name.replace('.glb', '');
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

        // Categorize into the 3 Buttons
        let singleModel = tempModels.find(m => /(single|one)/i.test(m.name));
        let twoModel = tempModels.find(m => /(two|dual)/i.test(m.name));
        let otherModel = tempModels.find(m => !/(single|one|two|dual)/i.test(m.name));

        models = []; 
        if (singleModel) { singleModel.variant = "Single Tone"; models.push(singleModel); }
        if (twoModel) { twoModel.variant = "Two Tone"; models.push(twoModel); }
        if (otherModel) { otherModel.variant = "Other"; models.push(otherModel); }

        if (models.length === 0) {
            tempModels[0].variant = "Model 1";
            models.push(tempModels[0]);
        }

        startApp();

    } catch (error) {
        console.warn("API Failed or Rate Limited. Using Hardcoded Fallback Models...", error);
        if(document.getElementById('infoName')) document.getElementById('infoName').innerText = "API LIMIT REACHED";
        
        models = [
            {
                src: "https://raw.githubusercontent.com/ecwgrpmkt-stack/ECW-Studio/main/models/Toyota%20H300%20Single%20Tone.glb",
                poster: "https://placehold.co/400x300/222/FFF.png?text=No+Preview",
                variant: "Single Tone"
            },
            {
                src: "https://raw.githubusercontent.com/ecwgrpmkt-stack/ECW-Studio/main/models/Toyota%20H300%20Two%20Tone.glb",
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
    resetGlobalTimers(); // Kick off UI timers
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

// --- TRANSITIONS & FETCHING ---
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
        try {
            currentIndex = index;
            loadModelData(currentIndex);
        } catch(e) { console.error(e); }

        setTimeout(() => {
            fadeOverlay.classList.remove('active');
            loader.classList.remove('active');
            resetGlobalTimers(); 
            preloadNextModel(); 
        }, 200); 

    }, 200); 
}

async function loadModelData(index) {
    if (!models[index]) return;
    const data = models[index];

    if(viewer) {
        viewer.poster = data.poster; 

        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }

        try {
            let finalBlob = null;

            if ('caches' in window) {
                const cache = await caches.open('ecw-3d-models-v1');
                const cachedResponse = await cache.match(data.src);

                if (cachedResponse) {
                    finalBlob = await cachedResponse.blob();
                } else {
                    const res = await fetch(data.src, { mode: 'cors' });
                    if (res.ok) {
                        finalBlob = await res.blob();
                        finalBlob = new Blob([finalBlob], { type: 'model/gltf-binary' });
                        cache.put(data.src, new Response(finalBlob));
                    }
                }
            } else {
                const res = await fetch(data.src, { mode: 'cors' });
                if (res.ok) finalBlob = await res.blob();
            }

            if (finalBlob) {
                const glbBlob = new Blob([finalBlob], { type: 'model/gltf-binary' });
                currentBlobUrl = URL.createObjectURL(glbBlob);
                viewer.src = currentBlobUrl;
            } else {
                viewer.src = data.src;
            }

        } catch (e) {
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

function preloadNextModel() {
    if (models.length > 1) {
        let nextIndex = (currentIndex + 1) % models.length;
        const nextModel = models[nextIndex];
        const img = new Image();
        img.src = nextModel.poster;

        if ('caches' in window) {
            caches.open('ecw-3d-models-v1').then(cache => {
                cache.match(nextModel.src).then(cachedResponse => {
                    if (!cachedResponse) {
                        fetch(nextModel.src, { mode: 'cors', priority: 'low' })
                            .then(res => res.blob())
                            .then(blob => {
                                const glbBlob = new Blob([blob], { type: 'model/gltf-binary' });
                                cache.put(nextModel.src, new Response(glbBlob));
                            })
                            .catch(() => {});
                    }
                });
            }).catch(() => {});
        }
    }
}

// --- GLOBAL UX & EVENT LOGIC ---
function setupEvents() {
    document.getElementById("fsBtn").onclick = () => {
        const app = document.getElementById("app");
        !document.fullscreenElement ? app.requestFullscreen() : document.exitFullscreen();
    };

    // 1. Global UI Interception (Hides icon, keeps auto-rotate alive)
    ['pointermove', 'pointerdown', 'keydown'].forEach(evt => {
        window.addEventListener(evt, resetGlobalTimers);
    });

    if(viewer) {
        // 2. Strict 3D Interaction (Stops auto-rotate)
        viewer.addEventListener('camera-change', (e) => {
            if (e.detail.source === 'user-interaction') {
                viewer.autoRotate = false;
                
                // Hide Hand Icon immediately
                const indicator = document.getElementById('idleIndicator');
                if (indicator) indicator.classList.remove('visible');

                // Restart the 3D-specific idle timer
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

// This runs on ANY mouse movement or click anywhere on the screen
function resetGlobalTimers() {
    const indicator = document.getElementById('idleIndicator');
    
    // Hide icon instantly to reduce visual clutter
    if(indicator && indicator.classList.contains('visible')) {
        indicator.classList.remove('visible');
    }
    
    // 3s Timer: Only show Hand Icon if they aren't interacting AND the car is auto-rotating
    clearTimeout(globalInteractionTimer);
    globalInteractionTimer = setTimeout(() => {
        if(viewer && viewer.autoRotate && indicator) {
            indicator.classList.add('visible');
        }
    }, IDLE_DELAY);

    // 60s Timer: Prevent slide switching while they are moving the mouse (using Color Editor)
    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => {
        if(models.length > 1) {
            transitionToModel((currentIndex + 1) % models.length);
        }
    }, SLIDE_DELAY);
}

initShowroom();
