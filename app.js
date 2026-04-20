document.addEventListener('DOMContentLoaded', () => {
    // 1. Language Toggle Logic
    const btnEn = document.getElementById('btn-en');
    const btnJp = document.getElementById('btn-jp');
    const elsEn = document.querySelectorAll('.lang-en');
    const elsJp = document.querySelectorAll('.lang-jp');

    function switchLanguage(lang) {
        if (lang === 'en') {
            btnEn.classList.add('active');
            btnJp.classList.remove('active');
            elsEn.forEach(el => el.classList.remove('hidden'));
            elsJp.forEach(el => el.classList.add('hidden'));
        } else {
            btnJp.classList.add('active');
            btnEn.classList.remove('active');
            elsJp.forEach(el => el.classList.remove('hidden'));
            elsEn.forEach(el => el.classList.add('hidden'));
        }
    }

    btnEn.addEventListener('click', () => switchLanguage('en'));
    btnJp.addEventListener('click', () => switchLanguage('jp'));

    // 2. Tornado UI Scroll Animation using Intersection Observer
    const tornadoItems = document.querySelectorAll('.tornado-item');

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.3
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add class to trigger CSS 3D transform animations
                entry.target.classList.add('visible');
            } else {
                // Optional: remove class when scrolling up to allow re-animation
                // entry.target.classList.remove('visible');
            }
        });
    }, observerOptions);

    tornadoItems.forEach(item => {
        observer.observe(item);
    });
});
