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
   ====== 論文道場 (Ronbun Dojo) 本格データパイプライン連動ロジック ======
   ========================================================================== */

/** [連動フック①] 画面側からデータを受け取ってローカルストレージへ保存 */
window.saveDojoData = function(data) {
    localStorage.setItem('ronbun_dojo_data', JSON.stringify(data));
    window.refreshDojoOutputs();
};

/** [連動フック②] スクロールやナビゲーションによるステージ切り替えを検知 */
window.onNavigate = function(stageId) {
    console.log("現在アクティブなステージ:", stageId);
    window.refreshDojoOutputs(stageId);
};

/** 【コアエンジン】蓄積された論文構造データから、L2〜L4のPlantUMLとプロンプトを自動生成 */
window.refreshDojoOutputs = function(currentStageId = 'stage0') {
    const rawData = localStorage.getItem('ronbun_dojo_data');
    if (!rawData) return;
    const d = JSON.parse(rawData);

    // ── ① L2 Container（コンテナ）図の動的組み立て ──
    const pumlContainer = document.getElementById('puml-container-area');
    if (pumlContainer) {
        pumlContainer.value = `@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml
title L2 Container - ${d.title || '研究テーマ未定'}

Person(researcher, "${d.author || '研究者'}", "論文執筆者（所属: ${d.affiliation || '未設定'}）")

System_Boundary(dojo_hub, "論文道場 (Ronbun Dojo) システム内部構造") {
    Container(ui, "フロントエンド画面 (dojo.html)", "Tailwind / HTML5", "構造化データ入力、スコール監視、C4モデル・多階層ビューア")
    Container(engine, "コア・データパイプライン (app.js)", "JavaScript (Local)", "状態管理、ローカルストレージ同期、学術プロンプト自動生成エンジン")
}

System_Ext(ai_model, "生成AI API (Gemini / Claude)", "プロンプト推論・推敲バックエンド")
System_Ext(puml_server, "PlantUMLレンダラー", "SVG/PNG動的描画エンジン")

Rel(researcher, ui, "研究メタデータ、RQ、章立て構成、参考文献の入力")
Rel(ui, engine, "スクロール・イベント検知による連動通知 (onNavigate)")
Rel(engine, ai_model, "洗練された7Rプロンプト（構造化コンテキスト付き）の送信")
Rel(ui, puml_server, "動的PlantUMLコードの送信・描画リクエスト")
@enduml`;
        if (typeof renderPlantUML === 'function') { renderPlantUML('puml-container-area'); }
    }

    // ── ② L3 Component（コンポーネント）図の動的組み立て ──
    const pumlComponent = document.getElementById('puml-component-area');
    if (pumlComponent) {
        pumlComponent.value = `@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml
title L3 Component - ${d.title || '研究テーマ未定'}

Container(ui, "フロントエンド画面 (dojo.html)", "Tailwind / HTML5")
System_Ext(ai_model, "生成AI API", "Gemini / Claude")

Container__Boundary(engine_box, "コア・データパイプライン (app.js)") {
    Component(save_hook, "saveDojoData フック", "JavaScript", "Stage 0 の全入力をバリデーションしてlocalStorageへ保存")
    Component(nav_hook, "onNavigate フック", "JavaScript", "IntersectionObserverの交差をトリガーにステージIDを捕捉")
    Component(generator, "refreshDojoOutputs エンジン", "JavaScript", "保存された学術データを読み込み、L1-L4コード・7Rプロンプトへ一括変換")
}

Rel(ui, save_hook, "「分析開始」クリック時のデータ送信")
Rel(ui, nav_hook, "特定セクションへのスクロール検知")
Rel(nav_hook, generator, "ステージ切り替えイベントの伝播")
Rel(save_hook, generator, "データ更新トリガーの引火")
Rel(generator, ai_model, "埋め込みテキストの射出")
@enduml`;
        if (typeof renderPlantUML === 'function') { renderPlantUML('puml-component-area'); }
    }

    // ── ③ Stage III: 7Rプロンプト群の動的組み立て ──
    const r1Area = document.getElementById('prompt-r1');
    if (r1Area) {
        r1Area.value = `【R1: Research Question最適化プロンプト】
あなたは最高峰の学術メンター（AI Nesan特製エンジン）です。以下の構造化情報をベースに、学術的問い（RQ）の整合性を徹底的に検証し、洗練させてください。

■ 執筆者: ${d.author} (${d.affiliation})
■ 研究題目: ${d.title}
■ 学術的問い (RQ): ${d.rq}
■ 立てた仮説: ${d.hypothesis}

【指示】
1. 現在のRQと仮説の間に「論理的跳躍」や「構造的破綻」がないか、C4モデルのL1/L2コンテキストに準拠してクロスチェックしてください。
2. 矛盾点を厳しく指摘した上で、より堅牢で検証可能な修正RQ案を3つ対比構造で提示してください。`;
    }
};
