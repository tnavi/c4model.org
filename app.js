document.addEventListener('DOMContentLoaded', () => {
    // 1. Language Toggle Logic
    const btnEn = document.getElementById('btn-en');
    const btnJp = document.getElementById('btn-jp');
    const elsEn = document.querySelectorAll('.lang-en');
    const elsJp = document.querySelectorAll('.lang-jp');

    function switchLanguage(lang) {
        if (lang === 'en') {
            if(btnEn) btnEn.classList.add('active');
            if(btnJp) btnJp.classList.remove('active');
            elsEn.forEach(el => el.classList.remove('hidden'));
            elsJp.forEach(el => el.classList.add('hidden'));
        } else {
            if(btnJp) btnJp.classList.add('active');
            if(btnEn) btnEn.classList.remove('active');
            elsJp.forEach(el => el.classList.remove('hidden'));
            elsEn.forEach(el => el.classList.add('hidden'));
        }
    }

    if(btnEn) btnEn.addEventListener('click', () => switchLanguage('en'));
    if(btnJp) btnJp.addEventListener('click', () => switchLanguage('jp'));

    // 2. Tornado UI Scroll Animation
    const tornadoItems = document.querySelectorAll('.tornado-item');
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.3 };

    const animObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    tornadoItems.forEach(item => animObserver.observe(item));
});

/* ==========================================================================
   ====== 論文道場 (Ronbun Dojo) 安定版システムロジック ======
   ========================================================================== */

/** 分析開始ボタンの連動用（エラーを回避する最低限の定義） */
window.saveDojoData = function(data) {
    localStorage.setItem('ronbun_dojo_data', JSON.stringify(data));
};

window.onNavigate = function(stageId) {
    // L2以降の自動図解処理は行いません
    console.log("ステージ切り替え:", stageId);
};
