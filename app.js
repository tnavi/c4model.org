/**
 * @file    app.js
 * @title   論文道場 Hub Script
 * @version 3.1.0
 * @author  奥村治 (Osamu Okumura) — C4モデル研究会®
 * @license MIT
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  §A  PlantUML Hex Encoder
 *        encodeHex(text)             UTF-8 → ~h + Hex 文字列
 *        encodePumlDeflate(text)     UTF-8 → ~1 + Base64/deflate（pako対応）
 *        _deflateStored(data)        pako非搭載時の stored block fallback
 *        _PL_B64 / _encode64()       PlantUML独自 Base64 テーブル
 *        _append3bytes()             Base64 3バイト変換
 *        buildPumlUrl(text, fmt)     長さで自動選択 → 公式サーバー URL 生成
 *        buildKrokiUrl(text)         Kroki フォールバック URL 生成
 *
 *  §B  Single PlantUML Renderer
 *        renderSinglePlantUML(areaId, imgId, errId)
 *                                    textarea → <img>.src を書き換える中核関数
 *        bindRenderButton(btnId, areaId, imgId, errId)
 *                                    「描画」ボタンに click を一度だけバインド
 *        _showRenderLoading(imgId)   ⏳ 描画中 インジケーター表示
 *        _hideRenderLoading(imgId)   インジケーター非表示
 *        _setRenderError(...)        エラーメッセージ表示
 *        _clearRenderError(errId)    エラーメッセージ消去
 *
 *  §C  DojoData Hub
 *        DOJO_STORAGE_KEY            localStorage 共通キー定数
 *        saveDojoData(dataObj)       Stage 0「分析開始」→ localStorage 保存
 *        loadDojoData()              localStorage → JSON | null
 *        restoreDojoData()           3段階自動マッピングで各 Stage UI に復元
 *        onNavigate(pageId)          go() 末尾フック（window に公開）
 *        _injectEl(el, value)        要素種別自動判定・既入力保護付き注入
 *        _injectById(id, value)      ID 指定注入ラッパー
 *        _setSelectValue(el, value)  <select> の option 照合セット
 *
 *  §D  描画ボタン バインド定義
 *        _RENDER_BINDINGS[]          Stage × {btnId, areaId, imgId, errId}
 *        _bindAllRenderButtons()     _RENDER_BINDINGS を走査して全バインド
 *
 *  §E  window への公開
 *        window.saveDojoData / loadDojoData / restoreDojoData / onNavigate
 *        window.renderSinglePlantUML / buildPumlUrl / encodeHex
 *
 *  §F  DOMContentLoaded
 *        F-1. Language Toggle        .lang-en / .lang-jp 表示切替
 *        F-2. Tornado UI             IntersectionObserver スクロールアニメ
 *        F-3. 描画ボタン 初回バインド  _bindAllRenderButtons()
 *        F-4. DojoData 初回復元      restoreDojoData()
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  互換保証（dojo.html インライン JS との接合点）
 *    window.saveDojoData(obj)   ← Stage 0「分析開始」ハンドラから呼ぶ
 *    window.onNavigate(pageId)  ← go(pageId) 末尾に 1 行追加するだけ
 *  変更なし
 *    既存 CSS / デザイントークン / PlantUML 描画 / IntersectionObserver
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   §A  PlantUML Hex Encoder
   ══════════════════════════════════════════════════════════════════════════
   公式サーバーは 2 種類のエンコード形式を受け付ける。
     A-1.  ~h + Hex 文字列         シンプル。UTF-8 バイト列を 16 進で表現。
     A-2.  ~1 + Base64/deflate     圧縮あり。長い図・C4 !include に適する。
   buildPumlUrl() が文字数で自動選択する。
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A-1  UTF-8 テキストを PlantUML Hex 形式に変換する。
 *
 * @param  {string} text  PlantUML ソースコード
 * @returns {string}      "~h" + 16 進文字列
 */
function encodeHex(text) {
    var bytes = new TextEncoder().encode(text);
    var hex   = '';
    for (var i = 0; i < bytes.length; i++) {
        var b = bytes[i].toString(16);
        hex  += (b.length === 1 ? '0' : '') + b;
    }
    return '~h' + hex;
}

/**
 * A-2  PlantUML 公式の ~1 + Base64/deflate 形式エンコード。
 *      pako が読み込まれていれば level-9 圧縮、なければ stored block で代替。
 *
 * @param  {string} text  PlantUML ソースコード
 * @returns {string}      "~1" + エンコード済み文字列
 */
function encodePumlDeflate(text) {
    var data = unescape(encodeURIComponent(text));   // UTF-8 バイト列
    var compressed = window.pako
        ? window.pako.deflateRaw(data, { level: 9, to: 'string' })
        : _deflateStored(data);
    return '~1' + _encode64(compressed);
}

/**
 * A-2a  pako 非搭載時の stored block（無圧縮 deflate）フォールバック。
 *       RFC 1951 stored block: BFINAL=1, BTYPE=00, LEN/NLEN + data。
 *       最大 65535 バイト / ブロック に対応。
 *
 * @private
 * @param  {string} data  Latin-1 文字列（UTF-8 バイト列を charCode で表現）
 * @returns {string}      deflate ストリーム
 */
function _deflateStored(data) {
    var out    = '';
    var len    = data.length;
    var BSIZE  = 65535;
    var blocks = Math.ceil(len / BSIZE) || 1;
    for (var b = 0; b < blocks; b++) {
        var chunk = data.slice(b * BSIZE, (b + 1) * BSIZE);
        var last  = (b === blocks - 1) ? 1 : 0;
        var clen  = chunk.length;
        var nclen = (~clen) & 0xFFFF;
        out += String.fromCharCode(last);              // BFINAL | BTYPE=00
        out += String.fromCharCode( clen        & 0xFF);  // LEN  lo
        out += String.fromCharCode((clen  >> 8) & 0xFF);  // LEN  hi
        out += String.fromCharCode( nclen       & 0xFF);  // NLEN lo
        out += String.fromCharCode((nclen >> 8) & 0xFF);  // NLEN hi
        out += chunk;
    }
    return out;
}

/**
 * PlantUML 独自 Base64 文字テーブル（標準 Base64 とは異なる 64 文字）。
 * @private
 */
var _PL_B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

/**
 * A-2b  PlantUML 独自 Base64 エンコード。3 バイト → 4 文字に変換する。
 *
 * @private
 * @param  {string} data  Latin-1 バイト列
 * @returns {string}
 */
function _encode64(data) {
    var out = '';
    for (var i = 0; i < data.length; i += 3) {
        out += _append3bytes(
            data.charCodeAt(i)     & 0xFF,
            data.charCodeAt(i + 1) & 0xFF,
            data.charCodeAt(i + 2) & 0xFF
        );
    }
    return out;
}

/** @private */
function _append3bytes(c1, c2, c3) {
    return _PL_B64[ c1 >> 2                        ]
         + _PL_B64[((c1 & 0x3) << 4) | (c2 >> 4)  ]
         + _PL_B64[((c2 & 0xF) << 2) | (c3 >> 6)  ]
         + _PL_B64[  c3 & 0x3F                     ];
}

/**
 * A-3  PlantUML 公式サーバー URL を生成する統合関数。
 *      2000 文字未満は Hex、それ以上は deflate を使用（失敗時は Hex へ自動降格）。
 *
 * @param  {string}  pumlText  PlantUML ソースコード
 * @param  {string} [fmt]      'svg'（既定）| 'png' | 'txt'
 * @returns {string}            完全な URL
 */
function buildPumlUrl(pumlText, fmt) {
    fmt = fmt || 'svg';
    var encoded;
    if (pumlText.length < 2000) {
        encoded = encodeHex(pumlText);
    } else {
        try {
            encoded = encodePumlDeflate(pumlText);
        } catch (_) {
            encoded = encodeHex(pumlText);           // deflate 失敗時フォールバック
        }
    }
    return 'https://www.plantuml.com/plantuml/' + fmt + '/' + encoded;
}

/**
 * A-4  Kroki フォールバック URL（公式サーバー障害時に使用）。
 *
 * @param  {string} pumlText
 * @returns {string}  URL、生成失敗時は空文字
 */
function buildKrokiUrl(pumlText) {
    try {
        return 'https://kroki.io/plantuml/svg/'
             + btoa(unescape(encodeURIComponent(pumlText)));
    } catch (_) {
        return '';
    }
}


/* ══════════════════════════════════════════════════════════════════════════
   §B  Single PlantUML Renderer
   ══════════════════════════════════════════════════════════════════════════
   「俳句の科学」と同一の操作フローを dojo.html 全 Stage に提供する。
   単一テキストエリア → 「描画」ボタン押下 → <img>.src 書き換え
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * テキストエリアの PlantUML コードを読み込み、対応する <img> の src を書き換える。
 *
 * ─ HTML 側の最小マークアップ（例）──────────────────────────────────
 *   <textarea id="puml-context-area">@startuml ... @enduml</textarea>
 *   <button id="btn-render-context">描画</button>
 *   <img     id="puml-context-img"  style="display:none" alt="PlantUML">
 *   <div     id="puml-context-err"  class="puml-error"   style="display:none"></div>
 * ─────────────────────────────────────────────────────────────────────
 *
 * @param {string}  areaId  テキストエリアの id
 * @param {string}  imgId   <img> タグの id
 * @param {string} [errId]  エラー表示 <div> の id（省略可）
 */
function renderSinglePlantUML(areaId, imgId, errId) {
    var area = document.getElementById(areaId);
    var img  = document.getElementById(imgId);
    if (!area || !img) {
        console.warn('[DojoRender] 要素が見つかりません:', areaId, imgId);
        return;
    }

    var pumlText = area.value.trim();

    // ── バリデーション ──────────────────────────────────────────────
    if (!pumlText) {
        _setRenderError(imgId, errId, 'PlantUML コードを入力してください。');
        return;
    }
    if (!pumlText.includes('@startuml') || !pumlText.includes('@enduml')) {
        _setRenderError(imgId, errId,
            '@startuml と @enduml を含む完全なコードを入力してください。');
        return;
    }

    // ── 描画開始 ────────────────────────────────────────────────────
    _clearRenderError(errId);
    img.style.display = 'none';
    img.style.opacity = '0';
    _showRenderLoading(imgId);

    var primaryUrl  = buildPumlUrl(pumlText, 'svg');
    var fallbackUrl = buildKrokiUrl(pumlText);

    // 一時 Image でプリロード（FOUC 防止のため src を確認してから差し替え）
    var probe = new Image();

    probe.onload = function () {
        _hideRenderLoading(imgId);
        img.src           = primaryUrl;
        img.style.display = 'block';
        img.style.opacity = '1';
        console.info('[DojoRender] 描画成功（公式サーバー）:', areaId);
    };

    probe.onerror = function () {
        console.warn('[DojoRender] 公式サーバー失敗 → Kroki フォールバック:', areaId);
        if (!fallbackUrl) {
            _hideRenderLoading(imgId);
            _setRenderError(imgId, errId,
                '⚠ 図の読み込みに失敗しました。PlantUML コードを確認してください。');
            return;
        }

        var probe2 = new Image();
        probe2.onload = function () {
            _hideRenderLoading(imgId);
            img.src           = fallbackUrl;
            img.style.display = 'block';
            img.style.opacity = '1';
            console.info('[DojoRender] 描画成功（Kroki）:', areaId);
        };
        probe2.onerror = function () {
            _hideRenderLoading(imgId);
            _setRenderError(imgId, errId,
                '⚠ 公式サーバー・Kroki ともに失敗しました。'
              + 'ネットワーク確認またはコードを見直してください。');
        };
        probe2.src = fallbackUrl;
    };

    probe.src = primaryUrl;
}

/**
 * 「描画」ボタンに renderSinglePlantUML を一度だけバインドする。
 * 重複登録防止のため data-dojo-bound 属性をフラグとして使用。
 *
 * @param {string}  btnId   ボタンの id
 * @param {string}  areaId  テキストエリアの id
 * @param {string}  imgId   <img> の id
 * @param {string} [errId]  エラー <div> の id（省略可）
 */
function bindRenderButton(btnId, areaId, imgId, errId) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    // ── 重複バインド防止 ─────────────────────────────────────────────
    if (btn.getAttribute('data-dojo-bound') === '1') return;
    btn.setAttribute('data-dojo-bound', '1');
    // ─────────────────────────────────────────────────────────────────
    btn.addEventListener('click', function () {
        renderSinglePlantUML(areaId, imgId, errId);
    });
}

/* ── §B プライベート：レンダリング UI ヘルパー ────────────────────── */

/** imgId → ローディング <div> の参照キャッシュ @private */
var _loadingEls = {};

/**
 * ローディングインジケーターを <img> の直前に挿入して表示する。
 * 初回呼び出し時のみ DOM に追加し、以降は同じ要素を再利用する。
 * @private
 */
function _showRenderLoading(imgId) {
    var img = document.getElementById(imgId);
    if (!img) return;
    var ld = _loadingEls[imgId];
    if (!ld) {
        ld             = document.createElement('div');
        ld.className   = 'puml-loading';
        ld.textContent = '⏳ 描画中…';
        ld.style.cssText =
            'font-size:.85rem;color:var(--ink-lite,#7A7A9A);padding:8px 0;';
        img.parentNode.insertBefore(ld, img);
        _loadingEls[imgId] = ld;
    }
    ld.style.display = 'block';
}

/** @private */
function _hideRenderLoading(imgId) {
    var ld = _loadingEls[imgId];
    if (ld) ld.style.display = 'none';
}

/** @private */
function _setRenderError(imgId, errId, msg) {
    var img = document.getElementById(imgId);
    if (img) img.style.display = 'none';
    _hideRenderLoading(imgId);
    if (!errId) { console.warn('[DojoRender]', msg); return; }
    var el = document.getElementById(errId);
    if (!el) return;
    el.textContent   = msg;
    el.style.display = 'block';
}

/** @private */
function _clearRenderError(errId) {
    if (!errId) return;
    var el = document.getElementById(errId);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}


/* ══════════════════════════════════════════════════════════════════════════
   §C  DojoData Hub
   ══════════════════════════════════════════════════════════════════════════
   Stage 0 で収集した論文データを localStorage に保持し、
   Stage I〜VII のどの画面に移動しても自動復元する。
   ══════════════════════════════════════════════════════════════════════════ */

/** localStorage キー（全ページ統一） */
var DOJO_STORAGE_KEY = 'dojoData_v1';

/**
 * Stage 0「分析開始」時に呼ぶ。論文データを localStorage へ保存する。
 * window に公開 → dojo.html インライン JS から window.saveDojoData({...}) で呼べる。
 *
 * @param {Object} dataObj  論文データ
 *   {
 *     author, affiliation, email,
 *     title, abstract, rq, hypothesis,
 *     structure, refs, prior, keywords, format
 *   }
 */
function saveDojoData(dataObj) {
    try {
        var payload = Object.assign({}, dataObj, {
            savedAt: new Date().toLocaleString('ja-JP')
        });
        localStorage.setItem(DOJO_STORAGE_KEY, JSON.stringify(payload));
        console.info('[DojoHub] saveDojoData 保存完了 —',
                     payload.title || '(タイトル未設定)');
    } catch (e) {
        console.error('[DojoHub] saveDojoData 失敗:', e);
    }
}

/**
 * localStorage から論文データを取得する。
 *
 * @returns {Object|null}  保存済みデータ、未保存・パース失敗時は null
 */
function loadDojoData() {
    try {
        var raw = localStorage.getItem(DOJO_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('[DojoHub] loadDojoData 失敗:', e);
        return null;
    }
}

/**
 * 保存済み論文データを各 Stage の UI 要素に流し込む。
 *
 * ■ 3段階の自動マッピング
 *   ① [data-dojo-placeholder] 属性の要素 → display:none（警告文を消す）
 *   ② [data-dojo-field="xxx"] 属性の要素 → fieldMap[xxx] を注入
 *   ③ Stage 別 固定 ID リスト            → _injectById() でフォールバック注入
 *
 * ■ 既入力保護
 *   textarea / input に既に値が入っている場合は上書きしない。
 */
function restoreDojoData() {
    var data = loadDojoData();
    if (!data) {
        console.info('[DojoHub] restoreDojoData: 保存データなし → スキップ');
        return;
    }
    console.info('[DojoHub] restoreDojoData: 復元開始 —',
                 data.title || '(タイトル未設定)');

    /* ─ ① プレースホルダー警告を非表示 ─────────────────────── */
    document.querySelectorAll('[data-dojo-placeholder]').forEach(function (el) {
        el.style.display = 'none';
    });

    /* ─ ② data-dojo-field 汎用マッピング ────────────────────── */
    var fieldMap = {
        'title'       : data.title                                       || '',
        'abstract'    : data.abstract                                    || '',
        'rq'          : data.rq                                          || '',
        'hypothesis'  : data.hypothesis                                  || '',
        'structure'   : data.structure                                   || '',
        'refs'        : data.refs                                        || '',
        'prior'       : data.prior                                       || '',
        'keywords'    : Array.isArray(data.keywords)
                            ? data.keywords.join('、')
                            : (data.keywords || ''),
        'format'      : data.format                                      || '',
        'author'      : data.author                                      || '',
        'affiliation' : data.affiliation                                 || '',
        'email'       : data.email                                       || '',
        'savedAt'     : data.savedAt                                     || ''
    };
    document.querySelectorAll('[data-dojo-field]').forEach(function (el) {
        var key = el.getAttribute('data-dojo-field');
        if (!(key in fieldMap) || !fieldMap[key]) return;
        _injectEl(el, fieldMap[key]);
    });

    /* ─ ③ Stage 別 固定 ID フォールバック ──────────────────────
       HTML 側に data-dojo-field 属性がない要素を ID 直打ちで補完する。
       ────────────────────────────────────────────────────────── */

    // Stage I — ideation
    _injectById('stage-i-title',       data.title);
    _injectById('stage-i-rq',          data.rq);
    _injectById('stage-i-abstract',    data.abstract);

    // Stage II — structure
    _injectById('stage-ii-title',      data.title);
    _injectById('stage-ii-rq',         data.rq);
    _injectById('stage-ii-structure',  data.structure);

    // Stage III — write（単一テキストエリア方式 / L2〜L4 タブ廃止）
    _injectById('puml-context-area',   data.structure || data.abstract);
    _injectById('stage-iii-title',     data.title);
    _injectById('stage-iii-rq',        data.rq);
    _injectById('stage-iii-abstract',  data.abstract);
    _injectById('stage-iii-structure', data.structure);

    // Stage IV — evaluate
    _injectById('stage-iv-title',      data.title);
    _injectById('stage-iv-abstract',   data.abstract);
    _injectById('stage-iv-rq',         data.rq);

    // Stage V — presentation
    _injectById('stage-v-title',       data.title);
    _injectById('stage-v-abstract',    data.abstract);

    // Stage VI — qa
    _injectById('stage-vi-title',      data.title);
    _injectById('stage-vi-rq',         data.rq);

    // Stage VII — submit
    _injectById('stage-vii-title',     data.title);
    _injectById('stage-vii-format',    data.format);

    // settings
    _injectById('set-title',           data.title);
    _injectById('set-abstract',        data.abstract);
    _injectById('set-rq',              data.rq);
    _injectById('set-author',          data.author);
    _injectById('set-affiliation',     data.affiliation);
    _injectById('set-structure',       data.structure);
    _injectById('set-refs',            data.refs);

    /* ─ ④ .dojo-paper-title スパン（ナビ等）一括更新 ────────── */
    if (data.title) {
        document.querySelectorAll('.dojo-paper-title').forEach(function (el) {
            el.textContent = data.title;
        });
    }

    console.info('[DojoHub] restoreDojoData: 復元完了');
}

/**
 * go(pageId) 末尾から呼ぶナビゲーションフック。
 * window に公開 → dojo.html インライン JS から window.onNavigate(pageId) で呼べる。
 *
 * dojo.html 側への追加は 1 行だけ:
 *   function go(pageId, btn) {
 *     ... 既存処理 ...
 *     if (typeof window.onNavigate === 'function') { window.onNavigate(pageId); }
 *   }
 *
 * @param {string} pageId  移動先ページ ID
 */
function onNavigate(pageId) {
    var stagePages = [
        'home',     'stage0',
        'ideation', 'structure', 'write',
        'evaluate', 'presentation', 'qa', 'submit',
        'settings', 'c4uml', 'genuml', 'formats', 'preview'
    ];
    if (stagePages.indexOf(pageId) !== -1) {
        restoreDojoData();
        _bindAllRenderButtons();   // 動的生成要素への再バインド（重複防止済み）
    }
}

/* ── §C プライベート：注入ユーティリティ ─────────────────────────── */

/**
 * 要素に値を注入する。タグ種別を自動判定し、既入力値は保護する。
 * @private
 */
function _injectEl(el, value) {
    if (!value) return;
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'input') {
        if (!el.value) el.value = value;
    } else if (tag === 'select') {
        _setSelectValue(el, value);
    } else {
        if (!el.textContent.trim()) el.textContent = value;
    }
}

/**
 * ID を指定して要素に値を注入するラッパー。
 * 要素が存在しない場合は何もしない（未使用 Stage の HTML がなくてもエラーにならない）。
 * @private
 */
function _injectById(id, value) {
    if (!value) return;
    var el = document.getElementById(id);
    if (!el) return;
    _injectEl(el, value);
}

/**
 * <select> の option を value / text で照合してセットする。
 * @private
 */
function _setSelectValue(selectEl, value) {
    for (var i = 0; i < selectEl.options.length; i++) {
        if (selectEl.options[i].value === value ||
            selectEl.options[i].text  === value) {
            selectEl.selectedIndex = i;
            return;
        }
    }
}


/* ══════════════════════════════════════════════════════════════════════════
   §B-2  Stage III 専用：6分割並列レンダリングエンジン
   ══════════════════════════════════════════════════════════════════════════
   「俳句の科学」と同一のアルゴリズム移植。
   俳句の科学では Claude API が JSON{ctx, ctr, cmp} で3コードを返し、
   それぞれを独立エンコードして3枚の<img>に配信する。
   論文道場では入力テキストを @startuml〜@enduml ブロック単位に分割し、
   最大6ブロックを6枚の<img>に独立配信する。

   ■ 入力フォーマット（テキストエリア内に複数 @startuml〜@enduml を記述）
     @startuml
     ' [1] L1: Context
     ... @enduml

     @startuml
     ' [2] L2: Container
     ... @enduml

     @startuml
     ' [3] L3: Component
     ... @enduml

     @startuml
     ' [4] L4: Dynamic
     ... @enduml

     @startuml
     ' [5] Sequence（シーケンス図）
     ... @enduml

     @startuml
     ' [6] State（状態遷移図）
     ... @enduml

   ■ 配信先 ID マッピング（_RENDER_BINDINGS の全エントリと1対1）
     ブロック[0] → puml-context-img   L1 Context     （btn-render-context が担当）
     ブロック[1] → puml-iii-l2-img    L2 Container   （自動配信）
     ブロック[2] → puml-iii-l3-img    L3 Component   （自動配信）
     ブロック[3] → puml-iii-l4-img    L4 Dynamic     （自動配信）
     ブロック[4] → puml-iii-seq-img   Sequence 図    （自動配信）
     ブロック[5] → puml-iii-sta-img   State 遷移図   （自動配信）
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * テキストエリアのテキストを @startuml〜@enduml ブロック単位に分割し、
 * 各ブロックを独立してエンコードして対応する <img> に配信する。
 * 「描画」ボタン（btn-render-context）onclick から直接呼び出す。
 * renderSinglePlantUML が L1（ブロック[0]）を描画した後に
 * この関数が L2〜State 遷移（ブロック[1]〜[5]）を追加描画する。
 *
 * @param {string} areaId  入力テキストエリアの id
 */
function renderStageIIIParallel(areaId) {
    var area = document.getElementById(areaId);
    if (!area) return;

    var fullText = area.value.trim();
    if (!fullText) return;

    /* ── ①  @startuml〜@enduml ブロックを全て抽出 ── */
    var blocks = [];
    var re = /@startuml[\s\S]*?@enduml/gi;
    var match;
    while ((match = re.exec(fullText)) !== null) {
        blocks.push(match[0].trim());
    }

    if (blocks.length === 0) return;   // ブロックが存在しない → 何もしない

    /* ── ②  ブロック[1]〜[5] を各 img へ独立配信 ──
            ブロック[0] は L1 として renderSinglePlantUML（既存）が処理済み。
            ここでは L2〜State 遷移に対応するブロック[1]〜[5] を処理する。   */
    var targets = [
        { idx: 1, imgId: 'puml-iii-l2-img',  errId: 'puml-iii-l2-err'  },
        { idx: 2, imgId: 'puml-iii-l3-img',  errId: 'puml-iii-l3-err'  },
        { idx: 3, imgId: 'puml-iii-l4-img',  errId: 'puml-iii-l4-err'  },
        { idx: 4, imgId: 'puml-iii-seq-img', errId: 'puml-iii-seq-err' },
        { idx: 5, imgId: 'puml-iii-sta-img', errId: 'puml-iii-sta-err' }
    ];

    targets.forEach(function (t) {
        var img = document.getElementById(t.imgId);
        var err = document.getElementById(t.errId);
        if (!img) return;

        if (t.idx >= blocks.length) {
            /* 入力ブロックが足りない場合 → プレースホルダーを維持 */
            if (err) {
                err.textContent = '💡 ブロック ' + (t.idx + 1) + ' 未記述 — '
                    + '「@startuml … @enduml」をテキストエリアに追記すると表示されます。';
                err.style.display = 'block';
            }
            img.style.display = 'none';
            img.src = '';
            return;
        }

        /* ブロックが存在する → 独立してエンコード・配信 */
        if (err) { err.textContent = ''; err.style.display = 'none'; }
        _deliverPumlToImg(blocks[t.idx], img, err);
    });
}

/**
 * PlantUMLテキストをエンコードして <img> に配信する内部ユーティリティ。
 * renderSinglePlantUML と同じエンコードパスを共有する。
 * @private
 */
function _deliverPumlToImg(pumlText, img, errEl) {
    if (!pumlText || !img) return;

    var primaryUrl  = buildPumlUrl(pumlText, 'svg');
    var fallbackUrl = buildKrokiUrl(pumlText);

    img.style.display = 'none';
    img.style.opacity = '0';

    var probe = new Image();
    probe.onload = function () {
        img.src           = primaryUrl;
        img.style.display = 'block';
        img.style.opacity = '1';
    };
    probe.onerror = function () {
        if (!fallbackUrl) {
            if (errEl) {
                errEl.textContent = '⚠ 図の読み込みに失敗しました。コードを確認してください。';
                errEl.style.display = 'block';
            }
            return;
        }
        var probe2 = new Image();
        probe2.onload = function () {
            img.src           = fallbackUrl;
            img.style.display = 'block';
            img.style.opacity = '1';
        };
        probe2.onerror = function () {
            if (errEl) {
                errEl.textContent = '⚠ 公式サーバー・Kroki ともに失敗しました。';
                errEl.style.display = 'block';
            }
        };
        probe2.src = fallbackUrl;
    };
    probe.src = primaryUrl;
}

/* window に公開（dojo.html インライン JS から呼び出し可） */
window.renderStageIIIParallel = renderStageIIIParallel;


/* ══════════════════════════════════════════════════════════════════════════
   §D  描画ボタン バインド定義
   ══════════════════════════════════════════════════════════════════════════
   各 Stage の「描画ボタン・テキストエリア・img・エラー div」の
   ID セットをここに集中管理する。
   Stage を追加・変更する際は _RENDER_BINDINGS の該当行だけ編集すればよい。
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Stage × UI 要素 ID マッピングテーブル。
 * HTML 側の id と 1 対 1 で対応する。
 *
 * @type {Array<{btnId:string, areaId:string, imgId:string, errId:string}>}
 */
var _RENDER_BINDINGS = [

    // ── Stage III — 6図独立エリア方式（ボタン廃止・oninput自動描画）────
    // 各図が独立した textarea を持つ。oninput → stageIIIAutoRender → _deliverPumlToImg。
    // go('write') → initStageIII() でページ表示時に全図を自動初期描画する。
    // btnId は HTML に存在しないため bindRenderButton が自動スキップ（安全）。
    { btnId: 'btn-render-iii-l1',
      areaId: 'puml-context-area',
      imgId:  'puml-context-img',
      errId:  'puml-context-err'   },

    { btnId: 'btn-render-iii-l2',
      areaId: 'puml-iii-l2-area',
      imgId:  'puml-iii-l2-img',
      errId:  'puml-iii-l2-err'   },

    { btnId: 'btn-render-iii-l3',
      areaId: 'puml-iii-l3-area',
      imgId:  'puml-iii-l3-img',
      errId:  'puml-iii-l3-err'   },

    { btnId: 'btn-render-iii-l4',
      areaId: 'puml-iii-l4-area',
      imgId:  'puml-iii-l4-img',
      errId:  'puml-iii-l4-err'   },

    { btnId: 'btn-render-iii-seq',
      areaId: 'puml-iii-seq-area',
      imgId:  'puml-iii-seq-img',
      errId:  'puml-iii-seq-err'  },

    { btnId: 'btn-render-iii-sta',
      areaId: 'puml-iii-sta-area',
      imgId:  'puml-iii-sta-img',
      errId:  'puml-iii-sta-err'  },

    // ── Stage I — ideation ────────────────────────────────────────────
    { btnId: 'btn-render-i',
      areaId: 'puml-i-area',
      imgId:  'puml-i-img',
      errId:  'puml-i-err'          },

    // ── Stage II — structure ──────────────────────────────────────────
    { btnId: 'btn-render-ii',
      areaId: 'puml-ii-area',
      imgId:  'puml-ii-img',
      errId:  'puml-ii-err'         },

    // ── Stage IV — evaluate ───────────────────────────────────────────
    { btnId: 'btn-render-iv',
      areaId: 'puml-iv-area',
      imgId:  'puml-iv-img',
      errId:  'puml-iv-err'         },

    // ── Stage V — presentation ────────────────────────────────────────
    { btnId: 'btn-render-v',
      areaId: 'puml-v-area',
      imgId:  'puml-v-img',
      errId:  'puml-v-err'          },

    // ── Stage VI — qa ─────────────────────────────────────────────────
    { btnId: 'btn-render-vi',
      areaId: 'puml-vi-area',
      imgId:  'puml-vi-img',
      errId:  'puml-vi-err'         },

    // ── Stage VII — submit ────────────────────────────────────────────
    { btnId: 'btn-render-vii',
      areaId: 'puml-vii-area',
      imgId:  'puml-vii-img',
      errId:  'puml-vii-err'        },

    // ── settings — PlantUML プレビュー ────────────────────────────────
    { btnId: 'btn-render-settings',
      areaId: 'puml-settings-area',
      imgId:  'puml-settings-img',
      errId:  'puml-settings-err'   }

];

/**
 * _RENDER_BINDINGS を走査して全描画ボタンにバインドする。
 * bindRenderButton 内の重複防止フラグにより、複数回呼んでも安全。
 * 存在しない id は無視する（未使用 Stage の HTML がなくてもエラーにならない）。
 * @private
 */
function _bindAllRenderButtons() {
    _RENDER_BINDINGS.forEach(function (b) {
        bindRenderButton(b.btnId, b.areaId, b.imgId, b.errId);
    });
}


/* ══════════════════════════════════════════════════════════════════════════
   §E  window への公開
   ══════════════════════════════════════════════════════════════════════════
   dojo.html のインライン JS（go() / startAnalysis() 等）から
   スクリプト読み込み順に依らず安全に参照できるよう window に明示的に登録する。
   ══════════════════════════════════════════════════════════════════════════ */

window.saveDojoData         = saveDojoData;
window.loadDojoData         = loadDojoData;
window.restoreDojoData      = restoreDojoData;
window.onNavigate           = onNavigate;
window.renderSinglePlantUML = renderSinglePlantUML;
window.buildPumlUrl         = buildPumlUrl;
window.encodeHex            = encodeHex;
window.buildKrokiUrl        = buildKrokiUrl;
window._deliverPumlToImg    = _deliverPumlToImg;   /* Stage III 自動描画から参照 */


/* ══════════════════════════════════════════════════════════════════════════
   §F  DOMContentLoaded
   ══════════════════════════════════════════════════════════════════════════
   §A〜§E はすべて DOMContentLoaded の外に定義しているため、
   dojo.html のインライン JS が先に評価されても参照可能。
   ══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {

    /* ──────────────────────────────────────────────────────────────────
       F-1  Language Toggle Logic
            .lang-en / .lang-jp の表示切替。hidden クラスで制御。
       ────────────────────────────────────────────────────────────────── */
    var btnEn = document.getElementById('btn-en');
    var btnJp = document.getElementById('btn-jp');
    var elsEn = document.querySelectorAll('.lang-en');
    var elsJp = document.querySelectorAll('.lang-jp');

    function switchLanguage(lang) {
        if (lang === 'en') {
            if (btnEn) btnEn.classList.add('active');
            if (btnJp) btnJp.classList.remove('active');
            elsEn.forEach(function (el) { el.classList.remove('hidden'); });
            elsJp.forEach(function (el) { el.classList.add('hidden');    });
        } else {
            if (btnJp) btnJp.classList.add('active');
            if (btnEn) btnEn.classList.remove('active');
            elsJp.forEach(function (el) { el.classList.remove('hidden'); });
            elsEn.forEach(function (el) { el.classList.add('hidden');    });
        }
    }

    if (btnEn) btnEn.addEventListener('click', function () { switchLanguage('en'); });
    if (btnJp) btnJp.addEventListener('click', function () { switchLanguage('jp'); });

    /* ──────────────────────────────────────────────────────────────────
       F-2  Tornado UI Scroll Animation
            IntersectionObserver で .tornado-item に visible クラスを付与。
       ────────────────────────────────────────────────────────────────── */
    var tornadoItems    = document.querySelectorAll('.tornado-item');
    var observerOptions = { root: null, rootMargin: '0px', threshold: 0.3 };

    var tornadoObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    tornadoItems.forEach(function (item) {
        tornadoObserver.observe(item);
    });

    /* ──────────────────────────────────────────────────────────────────
       F-3  PlantUML 描画ボタン 初回バインド
            _RENDER_BINDINGS テーブルに基づき全 Stage の描画ボタンを登録。
            存在しない id は自動スキップ。重複登録防止フラグ付き。
       ────────────────────────────────────────────────────────────────── */
    _bindAllRenderButtons();

    /* ──────────────────────────────────────────────────────────────────
       F-4  DojoData 初回ページ読み込み時の自動復元
            localStorage にデータが存在すれば、現在表示中の Stage に即座に反映。
       ────────────────────────────────────────────────────────────────── */
    restoreDojoData();

});
