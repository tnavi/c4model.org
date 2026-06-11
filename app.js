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
   ====== 論文道場 (Ronbun Dojo) コア・データパイプライン連動システム ======
   ========================================================================== */

/** [グローバル関数①] dojo.html の Stage 0 からデータを受け取って保存 */
window.saveDojoData = function(data) {
    localStorage.setItem('ronbun_dojo_data', JSON.stringify(data));
    // 保存された瞬間に現在のステージに応じた図・プロンプトを全リフレッシュ
    window.refreshDojoOutputs();
};

/** [グローバル関数②] dojo.html のスクロール・ナビゲーションと連動 */
window.onNavigate = function(stageId) {
    console.log("現在のステージ:", stageId);
    window.refreshDojoOutputs(stageId);
};

/** データをもとに画面上の各種テキスト（PlantUML / プロンプト）を動的生成 */
window.refreshDojoOutputs = function(currentStageId = 'stage0') {
    const rawData = localStorage.getItem('ronbun_dojo_data');
    if (!rawData) return;
    const d = JSON.parse(rawData);

    // --- 【L1~L4 C4モデル図の動的書き換えロジック】 ---
    const pumlContext = document.getElementById('puml-context-area'); // L1のテキストエリア
    const pumlContainer = document.getElementById('puml-container-area'); // L2のテキストエリア
    
    // 例: L2 Container図のコードを研究テーマ(d.title)などから自動組み立て
    if (pumlContainer) {
        pumlContainer.value = `@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml
title L2 Container - ${d.title || '研究テーマ未定'}

Person(researcher, "研究者", "論文執筆者")
System_Boundary(c1, "論文道場アーキテクチャ") {
    Container(web_app, "次世代SPA画面 (dojo.html)", "HTML/JS/Tailwind", "構造化入力・C4モデルビューア")
    Container(brain_hub, "データコア (app.js)", "JavaScript (Local)", "状態管理とプロンプトエンジニアリング・パイプライン")
}
System_Ext(ai_api, "生成AIモデル (Claude/Gemini)", "プロンプト推論エンジン")

Rel(researcher, web_app, "研究データ・構成案の入力")
Rel(web_app, brain_hub, "データ連携フック (onNavigate)")
Rel(brain_hub, ai_api, "最適化プロンプトの送信")
@enduml`;
        // もしPlantUMLの再描画関数があればトリガー
        if (typeof renderPlantUML === 'function') { renderPlantUML('puml-container-area'); }
    }

    // --- 【Stage III: 7Rプロンプト（R1~R7）の自動生成ロジック】 ---
    const r1Area = document.getElementById('prompt-r1');
    if (r1Area) {
        r1Area.value = `【R1: Research Question最適化プロンプト】
あなたは最高峰の学術メンターです。以下の研究情報をベースに、学術的問い（RQ）を徹底的に洗練させてください。

■ 研究題目: ${d.title}
■ 現在のRQ: ${d.rq}
■ 仮説: ${d.hypothesis}

上記に対する構造的欠陥を指摘し、C4モデル L1レベルに準拠した一貫性のあるRQの修正案を3つ提示してください。`;
    }
    
    // (必要に応じて R2 ~ R7 も同様に id に応じて生成)
};
