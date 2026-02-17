// Global state
let projects = [];
let visibleProjects = [];
let currentProjectIndex = -1;
let videoElement = null;
let volumeBtn = null;
let volumeSlider = null;
let volumeRange = null;

// Initialize app
async function init() {
    // Load data
    const response = await fetch('data.json');
    const data = await response.json();
    projects = data.projects;
    visibleProjects = projects.filter(p => p.visible);

    // Get DOM elements
    videoElement = document.getElementById('bgVideo');
    volumeBtn = document.getElementById('volumeBtn');
    volumeSlider = document.getElementById('volumeSlider');
    volumeRange = document.getElementById('volumeRange');

    // Render project list
    renderProjectList();

    // Start with random video
    playRandomVideo();

    // Setup event listeners
    setupEventListeners();
}

// Render project list in menu
function renderProjectList() {
    const projectList = document.getElementById('projectList');
    projectList.innerHTML = '';

    visibleProjects.forEach((project, index) => {
        const item = document.createElement('div');
        item.className = 'project-item';
        item.textContent = project.title;
        item.dataset.index = index;
        
        item.addEventListener('click', () => {
            navigateToProject(project.slug);
        });

        projectList.appendChild(item);
    });
}

// Play random video
function playRandomVideo() {
    if (visibleProjects.length === 0) return;

    // Get random index different from current
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * visibleProjects.length);
    } while (newIndex === currentProjectIndex && visibleProjects.length > 1);

    currentProjectIndex = newIndex;
    const project = visibleProjects[currentProjectIndex];

    // Update video source
    videoElement.src = project.videoPath;
    videoElement.load();
    videoElement.play();

    // Update UI
    updateSelectedProject(currentProjectIndex);
}

// Update selected project in menu
function updateSelectedProject(index) {
    const items = document.querySelectorAll('.project-item');
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Navigate to project page
function navigateToProject(slug) {
    document.body.classList.add('fade-out');
    setTimeout(() => {
        window.location.href = `project.html?slug=${slug}`;
    }, 500);
}

// Random button with roulette animation
function randomProject() {
    const randomBtn = document.getElementById('randomBtn');
    const items = document.querySelectorAll('.project-item');
    
    if (items.length === 0) return;

    // Disable button during animation
    randomBtn.disabled = true;
    randomBtn.style.opacity = '0.5';

    // Roulette animation: cycle through projects
    let currentIndex = 0;
    let iterations = 0;
    const maxIterations = 15 + Math.floor(Math.random() * 10); // 15-25 iterations
    const baseDelay = 50;
    
    function rouletteStep() {
        // Remove previous selection
        items.forEach(item => item.classList.remove('selected'));
        
        // Highlight current
        items[currentIndex].classList.add('selected');
        
        // Move to next
        currentIndex = (currentIndex + 1) % items.length;
        iterations++;
        
        if (iterations < maxIterations) {
            // Slow down progressively
            const delay = baseDelay + (iterations * 10);
            setTimeout(rouletteStep, delay);
        } else {
            // Final selection
            const finalIndex = Math.floor(Math.random() * items.length);
            items.forEach(item => item.classList.remove('selected'));
            items[finalIndex].classList.add('selected');
            
            // Navigate to selected project
            setTimeout(() => {
                const slug = visibleProjects[finalIndex].slug;
                navigateToProject(slug);
            }, 500);
        }
    }
    
    rouletteStep();
}

// Setup event listeners
function setupEventListeners() {
    // Video ended - play next random video
    videoElement.addEventListener('ended', () => {
        playRandomVideo();
    });

    // Random button
    const randomBtn = document.getElementById('randomBtn');
    randomBtn.addEventListener('click', () => {
        randomProject();
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

    // Close volume slider when clicking outside
    document.addEventListener('click', (e) => {
        if (!volumeSlider.classList.contains('hidden') && 
            !volumeSlider.contains(e.target) && 
            !volumeBtn.contains(e.target)) {
            volumeSlider.classList.add('hidden');
        }
    });
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
