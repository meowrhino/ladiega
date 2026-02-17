// Global state
let project = null;
let videoElement = null;
let veil = null;
let marqueeContainer = null;
let marqueeTexts = [];
let description = null;
let volumeBtn = null;
let volumeSlider = null;
let volumeRange = null;
let overlayHidden = false;

// Initialize app
async function init() {
    // Get slug from URL
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (!slug) {
        console.error('No slug provided');
        window.location.href = 'index.html';
        return;
    }

    // Load data
    const response = await fetch('data.json');
    const data = await response.json();
    project = data.projects.find(p => p.slug === slug);

    if (!project) {
        console.error('Project not found');
        window.location.href = 'index.html';
        return;
    }

    // Get DOM elements
    videoElement = document.getElementById('bgVideo');
    veil = document.getElementById('veil');
    marqueeContainer = document.getElementById('marqueeContainer');
    // Get all marquee text spans
    for (let i = 1; i <= 6; i++) {
        marqueeTexts.push(document.getElementById(`marqueeText${i}`));
    }
    description = document.getElementById('description');
    volumeBtn = document.getElementById('volumeBtn');
    volumeSlider = document.getElementById('volumeSlider');
    volumeRange = document.getElementById('volumeRange');

    // Load project content
    loadProject();

    // Setup event listeners
    setupEventListeners();
}

// Load project content
function loadProject() {
    // Set video source
    videoElement.src = project.videoPath;
    videoElement.load();
    videoElement.play();

    // Set marquee text (multiple repetitions for seamless loop)
    marqueeTexts.forEach(span => {
        span.textContent = project.title;
    });

    // Set description
    description.textContent = project.description;

    // Update page title
    document.title = `la diega - ${project.title}`;
}

// Toggle overlay (veil, marquee, description)
function toggleOverlay() {
    overlayHidden = !overlayHidden;

    if (overlayHidden) {
        veil.classList.add('hidden');
        marqueeContainer.classList.add('hidden');
        description.classList.add('hidden');
    } else {
        veil.classList.remove('hidden');
        marqueeContainer.classList.remove('hidden');
        description.classList.remove('hidden');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Click anywhere to toggle overlay
    document.body.addEventListener('click', (e) => {
        // Ignore clicks on volume controls and back button
        if (e.target.closest('.volume-control') || 
            e.target.closest('.back-btn')) {
            return;
        }
        toggleOverlay();
    });

    // Volume button toggle
    volumeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        volumeSlider.classList.toggle('hidden');
    });

    // Volume range change
    volumeRange.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        videoElement.volume = volume;
        videoElement.muted = volume === 0;
    });

    // Prevent back button from triggering overlay toggle and add fade out
    document.querySelector('.back-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    });
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
