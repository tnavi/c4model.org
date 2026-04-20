// ==========================================
// 1. Language Toggle (Optimized via CSS)
// ==========================================
function setLang(lang) {
    // Rely on CSS: html[lang="en"] [data-ja] { display: none; }
    document.documentElement.lang = lang;
    
    // Update button styling
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.dataset) {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        }
    });

    try {
        localStorage.setItem('c4-lang', lang);
    } catch (e) {}
}

// Init language from saved preference or browser default
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = (() => {
        try { return localStorage.getItem('c4-lang'); } catch(e){ return null; }
    })();
    const browserLang = navigator.language.startsWith('ja') ? 'ja' : 'en';
    setLang(savedLang || browserLang);
});

// ==========================================
// 2. Scroll Reveal Animations
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    observer.unobserve(e.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});

// ==========================================
// 3. Navbar Shrink Effect
// ==========================================
const nav = document.getElementById('main-nav');
if (nav) {
    window.addEventListener('scroll', () => {
        nav.style.height = window.scrollY > 50 ? '52px' : '60px';
    }, { passive: true });
}

// ==========================================
// 4. PlantUML Rendering Pipeline (for basho-case.html)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const diagramContainers = document.querySelectorAll('.diagram-view');
    
    diagramContainers.forEach(container => {
        const preCode = container.querySelector('.puml-code');
        const renderDiv = container.querySelector('.puml-render');
        
        if (preCode && renderDiv) {
            const rawPlantUml = preCode.textContent.trim();
            const encoded = plantumlEncoder.encode(rawPlantUml);
            const serverUrl = 'http://www.plantuml.com/plantuml/svg/';
            
            // Create responsive infinite-vector SVG image
            const imgTarget = document.createElement('img');
            imgTarget.src = serverUrl + encoded;
            imgTarget.alt = "PlantUML Generated Architectural Diagram";
            imgTarget.style.width = '100%';
            imgTarget.style.height = 'auto';
            imgTarget.style.marginTop = '1.5rem';
            imgTarget.style.borderRadius = '8px';
            
            renderDiv.appendChild(imgTarget);
        }
    });

    // Make sure old button ties to the new toggle logic if present
    const btnEn = document.getElementById('btn-en');
    const btnJp = document.getElementById('btn-jp');
    if (btnEn) btnEn.addEventListener('click', () => setLang('en'));
    if (btnJp) btnJp.addEventListener('click', () => setLang('ja'));
});
