const canvas = document.getElementById("bgCanvas");
const ctx = canvas.getContext("2d");

let particles = [];
const particleCount = 80; 

// Mouse tracking for parallax
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// Track mouse movement
document.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.05; // Sensitivity
    mouseY = (e.clientY - window.innerHeight / 2) * 0.05;
});

class Particle {
    constructor() {
        this.reset();
        // Start at random positions
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + Math.random() * 100; // Start below screen
        this.size = Math.random() * 2 + 0.5;
        this.speed = Math.random() * 0.5 + 0.2;
        this.opacity = Math.random() * 0.5 + 0.1;
        this.drift = (Math.random() - 0.5) * 0.5;
    }

    update() {
        this.y -= this.speed; // Float up
        this.x += this.drift;

        // Apply Parallax (Smooth lerp)
        this.x += (mouseX - targetX) * 0.02 * this.size; 
        this.y += (mouseY - targetY) * 0.02 * this.size;

        // Reset if out of bounds
        if (this.y < -10) this.reset();
        if (this.x > canvas.width + 10 || this.x < -10) {
            this.x = Math.random() * canvas.width;
        }
    }

    draw() {
        ctx.beginPath();
        // Soft Glow Effect
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
        gradient.addColorStop(0, `rgba(255, 50, 50, ${this.opacity})`); // Red Core
        gradient.addColorStop(1, "rgba(255, 50, 50, 0)"); // Fade out
        
        ctx.fillStyle = gradient;
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Init
for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Smooth out parallax movement
    targetX += (mouseX - targetX) * 0.1;
    targetY += (mouseY - targetY) * 0.1;

    particles.forEach(p => {
        p.update();
        p.draw();
    });
    
    requestAnimationFrame(animate);
}

animate();