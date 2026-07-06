// la diega — interfaz estilo videojuego (menu DS + ventanas 9-slice)

// Estado global
let DATA = null;
let menuEntries = [];      // [{slug, label}] categorias + about

// Niveles de navegacion: 'menu' → 'list' → 'content' → 'modal'
let level = 'menu';
let activeCategory = null; // categoria abierta en el panel lateral
let activeItem = null;     // marca/proyecto abierto en la ventana de contenido

// Elementos
let handCursor;
let menuBar, sidePanel, sidePanelTitle, sideList, contentWindow, contentTitle, contentBody;
let videoModal, modalVideo, modalFrame, modalIframe;
let volumeBtn, volumeSlider, volumeRange;

const isTouch = window.matchMedia('(pointer: coarse)').matches;

async function init() {
    const response = await fetch('data.json');
    DATA = await response.json();

    handCursor = document.getElementById('handCursor');
    menuBar = document.getElementById('menuBar');
    sidePanel = document.getElementById('sidePanel');
    sidePanelTitle = document.getElementById('sidePanelTitle');
    sideList = document.getElementById('sideList');
    contentWindow = document.getElementById('contentWindow');
    contentTitle = document.getElementById('contentTitle');
    contentBody = document.getElementById('contentBody');
    videoModal = document.getElementById('videoModal');
    modalVideo = document.getElementById('modalVideo');
    modalFrame = document.getElementById('modalFrame');
    modalIframe = document.getElementById('modalIframe');
    volumeBtn = document.getElementById('volumeBtn');
    volumeSlider = document.getElementById('volumeSlider');
    volumeRange = document.getElementById('volumeRange');

    menuEntries = DATA.categories.map(c => ({ slug: c.slug, label: c.label }));
    menuEntries.push({ slug: 'about', label: DATA.about.title || 'about' });

    renderMenuBar();
    setupEventListeners();
    const firstMenuItem = menuBar.querySelector('.selected');
    if (firstMenuItem) firstMenuItem.focus({ preventScroll: true });
    placeHand(firstMenuItem);
}

/* ===== Volumen y SFX ===== */

function getUiVolume() {
    return volumeRange.value / 100;
}

let audioCtx = null;

function playSfx(type) {
    const vol = getUiVolume();
    if (vol <= 0) return; // muteado → sin SFX
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const def = {
            move:   { f0: 620, f1: 620,  dur: 0.045 },
            select: { f0: 740, f1: 1180, dur: 0.09 },
            back:   { f0: 520, f1: 260,  dur: 0.08 }
        }[type];
        if (!def) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(def.f0, t);
        osc.frequency.linearRampToValueAtTime(def.f1, t + def.dur);
        gain.gain.setValueAtTime(0.1 * vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + def.dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + def.dur + 0.02);
    } catch (e) { /* sin audio, no pasa nada */ }
}

/* ===== Cursor manita ===== */

// ultimo elemento apuntado: la manita se queda donde paso el cursor por ultima vez
let handEl = null;

function placeHand(el) {
    if (isTouch || !el || el.offsetParent === null && el.getBoundingClientRect().width === 0) {
        handCursor.classList.add('hidden');
        handEl = null;
        return;
    }
    handEl = el;
    const rect = el.getBoundingClientRect();
    handCursor.classList.remove('hidden');
    handCursor.style.left = (rect.left - 38) + 'px';
    handCursor.style.top = (rect.top + rect.height / 2 - 9) + 'px';
}

function getSelectedElement() {
    const container = {
        menu: menuBar,
        list: sideList,
        content: contentBody,
        modal: null
    }[level];
    if (!container) return null;
    return container.querySelector('.selected');
}

function refreshHand() {
    // esperar a que acabe la animacion de apertura de ventana
    setTimeout(() => placeHand(getSelectedElement()), 170);
}

/* ===== Seleccion generica ===== */

// marca .selected dentro de un contenedor y mueve foco + manita
function setSelection(container, index, { silent = false, focus = true } = {}) {
    const items = Array.from(container.querySelectorAll('[data-nav]'));
    if (items.length === 0) return;
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    const prev = container.querySelector('.selected');
    const next = items[clamped];
    if (prev === next) { placeHand(next); return; }
    if (prev) prev.classList.remove('selected');
    next.classList.add('selected');
    if (focus) next.focus({ preventScroll: false });
    placeHand(next);
    if (!silent) playSfx('move');
}

function selectedIndex(container) {
    const items = Array.from(container.querySelectorAll('[data-nav]'));
    return Math.max(0, items.findIndex(el => el.classList.contains('selected')));
}

/* ===== Barra de menu ===== */

function renderMenuBar() {
    menuBar.innerHTML = '';
    menuEntries.forEach((entry, i) => {
        const btn = document.createElement('button');
        btn.className = 'menu-item';
        btn.textContent = entry.label;
        btn.dataset.nav = i;
        if (i === 0) btn.classList.add('selected');
        btn.addEventListener('click', () => {
            setSelection(menuBar, i, { silent: true });
            toggleCategory(entry.slug);
        });
        // la manita sigue siempre al cursor, aunque haya una ventana abierta
        btn.addEventListener('mouseenter', () => setSelection(menuBar, i, { focus: false }));
        menuBar.appendChild(btn);
    });
}

function toggleCategory(slug) {
    const openSlug = activeCategory ? activeCategory.slug : (contentWindow.classList.contains('hidden') ? null : 'about');
    if (openSlug === slug) {
        // volver a cerrar
        closeAll();
        playSfx('back');
        return;
    }
    closeAll({ silent: true });
    playSfx('select');
    menuBar.querySelectorAll('.menu-item').forEach((el, i) => {
        el.classList.toggle('open', menuEntries[i].slug === slug);
    });
    if (slug === 'about') {
        openAbout();
    } else {
        openCategory(slug);
    }
}

function closeAll({ silent = true } = {}) {
    sidePanel.classList.add('hidden');
    contentWindow.classList.add('hidden');
    stopModal();
    videoModal.classList.add('hidden');
    activeCategory = null;
    activeItem = null;
    level = 'menu';
    menuBar.querySelectorAll('.menu-item').forEach(el => el.classList.remove('open'));
    const sel = menuBar.querySelector('.selected');
    if (sel) sel.focus({ preventScroll: true });
    placeHand(sel);
    if (!silent) playSfx('back');
}

/* ===== Panel lateral ===== */

function openCategory(slug) {
    activeCategory = DATA.categories.find(c => c.slug === slug);
    if (!activeCategory) return;
    sidePanelTitle.textContent = activeCategory.label;
    sideList.innerHTML = '';
    const items = activeCategory.items.filter(item => item.visible);
    items.forEach((item, i) => {
        const btn = document.createElement('button');
        btn.className = 'side-item';
        btn.textContent = item.name;
        btn.dataset.nav = i;
        if (i === 0) btn.classList.add('selected');
        btn.addEventListener('click', () => {
            setSelection(sideList, i, { silent: true });
            openItem(item);
        });
        btn.addEventListener('mouseenter', () => setSelection(sideList, i, { focus: false }));
        sideList.appendChild(btn);
    });
    sidePanel.classList.remove('hidden');
    level = 'list';
    const first = sideList.querySelector('.selected');
    if (first) first.focus({ preventScroll: true });
    refreshHand();
}

function closeSidePanel() {
    contentWindow.classList.add('hidden');
    sidePanel.classList.add('hidden');
    activeCategory = null;
    activeItem = null;
    closeAll({ silent: true });
    playSfx('back');
}

/* ===== Ventana de contenido ===== */

function openItem(item) {
    activeItem = item;
    playSfx('select');
    contentTitle.textContent = item.name;
    contentBody.innerHTML = '';

    const projects = item.projects.filter(p => p.visible);
    if (projects.length === 0) {
        const msg = document.createElement('p');
        msg.className = 'empty-msg';
        msg.textContent = 'coming soon…';
        contentBody.appendChild(msg);
    }

    projects.forEach((project, i) => {
        const card = document.createElement('button');
        card.className = 'card';
        card.dataset.nav = i;
        if (i === 0) card.classList.add('selected');

        const thumb = document.createElement('span');
        thumb.className = 'card-thumb';
        if (project.videoPath) {
            const vid = document.createElement('video');
            vid.src = project.videoPath;
            vid.preload = 'metadata';
            vid.muted = true;
            vid.playsInline = true;
            thumb.appendChild(vid);
        } else if (project.embedUrl) {
            // enlace externo sin video: miniatura con el nombre de la plataforma
            const label = document.createElement('span');
            label.className = 'thumb-embed-label';
            label.textContent = project.embedUrl.includes('spotify') ? 'spotify'
                : (project.embedUrl.includes('youtu') ? 'youtube' : 'link');
            thumb.appendChild(label);
        }
        const overlay = document.createElement('span');
        overlay.className = 'play-overlay';
        thumb.appendChild(overlay);

        const info = document.createElement('span');
        info.className = 'card-info';
        const title = document.createElement('span');
        title.className = 'card-title';
        title.textContent = project.title;
        info.appendChild(title);
        if (project.job) {
            const job = document.createElement('span');
            job.className = 'card-line';
            job.textContent = 'Job: ' + project.job;
            info.appendChild(job);
        }
        if (project.studio) {
            const studio = document.createElement('span');
            studio.className = 'card-line';
            studio.textContent = 'Studio: ' + project.studio;
            info.appendChild(studio);
        }

        card.appendChild(thumb);
        card.appendChild(info);
        card.addEventListener('click', () => {
            setSelection(contentBody, i, { silent: true });
            openModal(project);
        });
        card.addEventListener('mouseenter', () => setSelection(contentBody, i, { focus: false }));
        contentBody.appendChild(card);
    });

    contentWindow.classList.remove('hidden');
    level = 'content';
    const first = contentBody.querySelector('.selected');
    if (first) first.focus({ preventScroll: true });
    refreshHand();
}

function closeContent() {
    contentWindow.classList.add('hidden');
    activeItem = null;
    playSfx('back');
    if (activeCategory) {
        level = 'list';
        const sel = sideList.querySelector('.selected');
        if (sel) sel.focus({ preventScroll: true });
        placeHand(sel);
    } else {
        closeAll({ silent: true });
    }
}

function openAbout() {
    activeItem = null;
    contentTitle.textContent = DATA.about.title || 'about';
    contentBody.innerHTML = '';
    (DATA.about.text || []).forEach(line => {
        const p = document.createElement('p');
        p.className = 'about-text';
        p.textContent = line;
        contentBody.appendChild(p);
    });
    contentWindow.classList.remove('hidden');
    level = 'content';
    playSfx('select');
    document.getElementById('contentClose').focus({ preventScroll: true });
    placeHand(null);
}

/* ===== Modal de video / embed ===== */

// convierte enlaces normales de youtube/spotify en su version embed
function toEmbedUrl(url) {
    let m = url.match(/youtu\.be\/([\w-]+)/) || url.match(/youtube\.com\/watch\?.*v=([\w-]+)/);
    if (m) return 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1';
    m = url.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|artist|episode|show)\/(\w+)/);
    if (m) return 'https://open.spotify.com/embed/' + m[1] + '/' + m[2];
    return url;
}

function openModal(project) {
    playSfx('select');
    modalFrame.classList.remove('embed-video', 'embed-spotify');
    if (project.embedUrl) {
        // enlace externo (spotify / youtube) dentro del mismo marco
        const url = toEmbedUrl(project.embedUrl);
        modalFrame.classList.add(url.includes('spotify') ? 'embed-spotify' : 'embed-video');
        modalIframe.src = url;
        modalIframe.classList.remove('hidden');
        modalVideo.classList.add('hidden');
    } else {
        modalVideo.src = project.videoPath;
        modalVideo.muted = false;
        modalVideo.volume = 1;
        modalVideo.classList.remove('hidden');
        modalIframe.classList.add('hidden');
    }
    videoModal.classList.remove('hidden');
    if (!project.embedUrl) modalVideo.play();
    level = 'modal';
    document.getElementById('modalClose').focus({ preventScroll: true });
    placeHand(null);
}

function stopModal() {
    modalVideo.pause();
    modalVideo.removeAttribute('src');
    modalVideo.load();
    modalIframe.removeAttribute('src');
}

function closeModal() {
    stopModal();
    videoModal.classList.add('hidden');
    playSfx('back');
    level = 'content';
    const sel = contentBody.querySelector('.selected');
    if (sel) sel.focus({ preventScroll: true });
    placeHand(sel);
}

/* ===== Teclado ===== */

function handleKeydown(e) {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT') return; // slider de volumen

    const back = e.key === 'Escape' || e.key === 'Backspace';

    if (level === 'modal') {
        if (back) { e.preventDefault(); closeModal(); }
        return;
    }

    if (back) {
        e.preventDefault();
        if (level === 'content') closeContent();
        else if (level === 'list') closeSidePanel();
        return;
    }

    if (level === 'menu') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const delta = e.key === 'ArrowRight' ? 1 : -1;
            setSelection(menuBar, selectedIndex(menuBar) + delta);
        }
    } else if (level === 'list') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const delta = e.key === 'ArrowDown' ? 1 : -1;
            setSelection(sideList, selectedIndex(sideList) + delta);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // cambiar de categoria sin volver al menu, estilo L/R de la DS
            e.preventDefault();
            const delta = e.key === 'ArrowRight' ? 1 : -1;
            const next = (selectedIndex(menuBar) + delta + menuEntries.length) % menuEntries.length;
            setSelection(menuBar, next, { silent: true, focus: false });
            toggleCategory(menuEntries[next].slug);
        }
    } else if (level === 'content') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const delta = e.key === 'ArrowDown' ? 1 : -1;
            setSelection(contentBody, selectedIndex(contentBody) + delta);
        }
    }
}

/* ===== Listeners ===== */

function setupEventListeners() {
    document.getElementById('sidePanelClose').addEventListener('click', closeSidePanel);
    document.getElementById('contentClose').addEventListener('click', closeContent);
    document.getElementById('modalClose').addEventListener('click', closeModal);

    videoModal.addEventListener('click', (e) => {
        if (e.target === videoModal) closeModal();
    });

    document.addEventListener('keydown', handleKeydown);

    // Volumen (afecta a los SFX; el modal de video va aparte)
    volumeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        volumeSlider.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!volumeSlider.classList.contains('hidden') &&
            !volumeSlider.contains(e.target) &&
            !volumeBtn.contains(e.target)) {
            volumeSlider.classList.add('hidden');
        }
    });

    // la manita sigue al ultimo elemento apuntado aunque cambie el layout
    window.addEventListener('resize', () => placeHand(handEl || getSelectedElement()));
    sideList.addEventListener('scroll', () => placeHand(handEl || getSelectedElement()));
    contentBody.addEventListener('scroll', () => placeHand(handEl || getSelectedElement()));
}

document.addEventListener('DOMContentLoaded', init);
