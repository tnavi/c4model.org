document.addEventListener('DOMContentLoaded', () => {
    // 1. Language Toggle
    const btnEn = document.getElementById('btn-en');
    const btnJp = document.getElementById('btn-jp');
    if (btnEn && btnJp) {
        btnEn.addEventListener('click', () => switchLanguage('en'));
        btnJp.addEventListener('click', () => switchLanguage('jp'));
    }

    function switchLanguage(lang) {
        const elsEn = document.querySelectorAll('.lang-en');
        const elsJp = document.querySelectorAll('.lang-jp');
        if (lang === 'en') {
            btnEn.classList.add('active'); btnJp.classList.remove('active');
            elsEn.forEach(el => el.classList.remove('hidden'));
            elsJp.forEach(el => el.classList.add('hidden'));
        } else {
            btnJp.classList.add('active'); btnEn.classList.remove('active');
            elsJp.forEach(el => el.classList.remove('hidden'));
            elsEn.forEach(el => el.classList.add('hidden'));
        }
    }

    // 2. Tab Click System (俳句の科学・多階層タブ切り替えアルゴリズムの移植)
    setupDojoTabs();
});

/** 画面上のL1~L4のタブ切り替えイベントをリッスンする関数 */
function setupDojoTabs() {
    // 通常表示用タブ
    const tabs = document.querySelectorAll('.diagram-tabs .dtab, .pdf-c4-tabs .pdf-ctab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const targetTab = e.currentTarget;
            const parent = targetTab.parentElement;
            
            // 同一グループのタブの active クラスを解除
            parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            targetTab.classList.add('active');

            // 対応するパネル（L1~L4）の表示切り替え
            const layer = targetTab.getAttribute('data-layer') || targetTab.innerText.match(/L\d/)[0];
            const section = targetTab.closest('section, .fs-preview-card');
            
            if (section) {
                const panels = section.querySelectorAll('.diagram-panel, .pdf-c4-panel');
                panels.forEach(panel => {
                    const panelLayer = panel.getAttribute('data-layer') || panel.id;
                    if (panelLayer.includes(layer.toLowerCase())) {
                        panel.classList.add('active');
                        // タブが開かれた瞬間にその階層のPlantUMLを最新URLで動的レンダリング！
                        const textarea = panel.querySelector('textarea, pre');
                        if (textarea) { renderSinglePlantUML(textarea.id || textarea.name); }
                    } else {
                        panel.classList.remove('active');
                    }
                });
            }
        });
    });
}

/* ==========================================================================
   ====== PLANTUML TEXT TO SVG ENCODING ALGORITHM (図解化の核) ======
   ========================================================================== */

/** テキストエリアのPlantUMLコードを読み込み、公式サーバーのURLに変換してimgを書き換える */
function renderSinglePlantUML(targetAreaId) {
    const area = document.getElementById(targetAreaId);
    if (!area) return;

    let pumlCode = area.value || area.innerText || '';
    pumlCode = pumlCode.trim();
    if (!pumlCode) return;

    // 親要素を探して、中にある img タグを捕捉
    const parentWrap = area.closest('.grid, .pdf-c4-img-wrap, .puml-wrap');
    if (!parentWrap) return;
    
    const img = parentWrap.querySelector('img');
    const loadingDiv = parentWrap.querySelector('.puml-loading, .pdf-c4-loading');

    if (img) {
        // PlantUMLテキストを公式サーバーが受け取れる特殊な圧縮(Hex形式)に変形
        const encodedUrl = "https://www.plantuml.com/plantuml/svg/" + plantuml_encode(pumlCode);
        
        if (loadingDiv) loadingDiv.style.display = 'block';
        img.src = encodedUrl;
        img.onload = () => {
            if (loadingDiv) loadingDiv.style.display = 'none';
            img.style.display = 'block';
        };
    }
}

/** PlantUML標準エンコードアルゴリズム (UTF-8 Hex / Deflate簡易互換) */
function plantuml_encode(text) {
    // 簡易的なクライアントサイドPlantUMLエンコーダー (Hexフォールバック、または標準圧縮)
    // ブラウザで最も安定して動作するURLエンコード＋Hex表現
    try {
        return encodeHex(utf8_to_b64(text));
    } catch(e) {
        return btoa(encodeUrlComponent(text)); 
    }
}
function utf8_to_b64(str) { return btoa(unescape(encodeURIComponent(str))); }
function encodeHex(b64) {
    const raw = atob(b64);
    let result = "~h"; // PlantUML Hexプレフィックス
    for (let i = 0; i < raw.length; i++) {
        const hex = raw.charCodeAt(i).toString(16);
        result += (hex.length === 1 ? "0" : "") + hex;
    }
    return result;
}

/* ==========================================================================
   ====== 論文道場 (Ronbun Dojo) 本格データパイプライン連動ロジック ======
   ========================================================================== */

window.saveDojoData = function(data) {
    localStorage.setItem('ronbun_dojo_data', JSON.stringify(data));
    window.refreshDojoOutputs();
};

window.onNavigate = function(stageId) {
    window.refreshDojoOutputs(stageId);
};

/** 【コアエンジン】蓄積された学術データからL1〜L4のコードを生成し、即時描写 */
window.refreshDojoOutputs = function(currentStageId = 'stage0') {
    const rawData = localStorage.getItem('ronbun_dojo_data');
    if (!rawData) return;
    const d = JSON.parse(rawData);

    // ── L1 Context ──
    const pumlL1 = document.getElementById('puml-context-area');
    if (pumlL1) {
        renderSinglePlantUML('puml-context-area');
    }

    // ── L2 Container 図のテキスト自動生成 ──
    const pumlL2 = document.getElementById('puml-container-area');
    if (pumlL2) {
        pumlL2.value = `@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml
title L2 Container - ${d.title || '研究テーマ未定'}

Person(researcher, "${d.author || '研究者'}", "論文執筆者")
System_Boundary(dojo, "論文道場アーキテクチャシステム") {
    Container(ui, "フロントエンド画面 (dojo.html)", "Tailwind HTML", "構造化入力・多階層C4ビューア")
    Container(hub, "データコアコア (app.js)", "JavaScript", "状態管理、Hexエンコーダー、プロンプト生成")
}
System_Ext(puml_server, "PlantUML Server", "公式レンダラー")
Rel(researcher, ui, "データを入力")
Rel(ui, hub, "イベント通知 (onNavigate)")
Rel(hub, puml_server, "Hex変換コード送信")
@enduml`;
        // 生成されたL2コードをその場で即座に画像化！
        renderSinglePlantUML('puml-container-area');
    }

    // ── Stage III: 7Rプロンプトの自動生成 ──
    const r1Area = document.getElementById('prompt-r1');
    if (r1Area) {
        r1Area.value = `【R1: Research Question最適化プロンプト】
■ 執筆者: ${d.author || '未定'}
■ 研究題目: ${d.title || '未定'}
■ RQ: ${d.rq || '未定'}

上記の構造を検証し、C4モデル L1/L2レベルに準拠した一貫性のある学術的問い（RQ）の修正案を提示してください。`;
    }
};
