# SKILL: html2pdf.js による PDF 出力バグ防止

## 概要
html2pdf.js（html2canvas + jsPDF）を使用する HTML アプリで PDF が**白紙になる**、
または**内容が欠ける**バグのパターンと再発防止策をまとめる。

---

## 確認された3つのバグパターン

### バグ① `display:none` 要素のキャプチャ → 白紙
**原因**: html2pdf は `from(element)` に渡した要素が `display:none` や
`visibility:hidden` の状態でも処理を進めるが、html2canvas はレンダリングできず白紙になる。

**再発防止**: PDF生成前に対象要素の表示を強制する。

```js
const outputWrap = document.getElementById('fs-output-wrap');
const wasHidden = !outputWrap.classList.contains('active');
if (wasHidden) {
  outputWrap.style.display = 'block';
  outputWrap.style.visibility = 'visible';
}
// ... PDF生成 ...
// finally で元に戻す
if (wasHidden) {
  outputWrap.style.display = '';
  outputWrap.style.visibility = '';
}
```

---

### バグ② タブパネル復元の順序ミス → 表示崩れ
**原因**: `finally` で全パネルを `display:''` にリセットした後、
`.active` 要素を再表示しようとする際に active クラスの CSS が上書きされず状態が壊れる。

**再発防止**: PDF生成前にアクティブパネルを変数に保存し、`finally` で明示的に復元する。

```js
// 事前保存
const activePanel = document.querySelector('.pdf-c4-panel.active');

// finally での復元（順序が重要）
document.querySelectorAll('.pdf-c4-panel').forEach(p => {
  p.style.display = '';
  p.style.visibility = '';
});
if (activePanel) activePanel.style.display = 'block'; // 明示的に再表示
```

---

### バグ③ 非同期画像（PlantUML等）のキャプチャ欠け
**原因**: 外部サーバー（PlantUML サーバー等）から `<img>` を遅延読み込みしている場合、
html2canvas がキャプチャするタイミングで画像がまだ読み込まれていない。

**再発防止**: 全 `<img>` の読み込み完了を待ってから html2pdf を呼ぶ。

```js
const imgs = document.querySelectorAll('#pdf-target img');
await Promise.all([...imgs].map(img => {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise(resolve => {
    img.onload  = resolve;
    img.onerror = resolve;          // エラーでも止めない
    setTimeout(resolve, 5000);      // 最大5秒タイムアウト
  });
}));
await new Promise(r => setTimeout(r, 500)); // レイアウト安定待機
```

---

## html2pdf の推奨オプション設定

```js
const opt = {
  margin:      [10, 10, 10, 10],
  filename:    'output.pdf',
  image:       { type: 'jpeg', quality: 0.95 },
  html2canvas: {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#FFFFFF',
    scrollX: 0,
    scrollY: 0,                                        // スクロール位置リセット必須
    windowWidth: document.documentElement.scrollWidth, // 全幅キャプチャ
    logging: false
  },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
};
```

---

## 完全な exportPDF 関数テンプレート

```js
async function exportPDF() {
  if (!hasContent()) { alert('先にコンテンツを生成してください。'); return; }

  const btn = event.target;
  btn.textContent = '⏳ PDF生成中…';
  btn.disabled = true;

  // ① active パネルを事前保存（タブUI用）
  const activePanel = document.querySelector('.pdf-c4-panel.active');

  // ② 対象要素を強制表示（display:none 対策）
  const target = document.getElementById('pdf-target');
  const targetWrap = target.closest('.output-wrap');
  const wasHidden = targetWrap && getComputedStyle(targetWrap).display === 'none';
  if (wasHidden) {
    targetWrap.style.display = 'block';
    targetWrap.style.visibility = 'visible';
  }

  // ③ タブパネルを全表示（PDF には全図を含める場合）
  document.querySelectorAll('.pdf-c4-panel').forEach(p => {
    p.style.display = 'block';
    p.style.visibility = 'visible';
  });

  // ④ 非同期画像の読み込み完了を待機
  const imgs = target.querySelectorAll('img');
  await Promise.all([...imgs].map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.onload  = resolve;
      img.onerror = resolve;
      setTimeout(resolve, 5000);
    });
  }));
  await new Promise(r => setTimeout(r, 500));

  const opt = {
    margin: [10, 10, 10, 10],
    filename: 'output.pdf',
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: {
      scale: 2, useCORS: true, allowTaint: true,
      backgroundColor: '#FFFFFF',
      scrollX: 0, scrollY: 0,
      windowWidth: document.documentElement.scrollWidth,
      logging: false
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  try {
    await html2pdf().set(opt).from(target).save();
  } catch (e) {
    alert('PDF生成に失敗しました。ブラウザの印刷機能（Ctrl+P）をお試しください。');
    console.error('[exportPDF]', e);
  } finally {
    // ⑤ 表示状態を正確に復元
    document.querySelectorAll('.pdf-c4-panel').forEach(p => {
      p.style.display = '';
      p.style.visibility = '';
    });
    if (activePanel) activePanel.style.display = 'block';

    if (wasHidden) {
      targetWrap.style.display = '';
      targetWrap.style.visibility = '';
    }

    btn.textContent = '📄 PDF出力';
    btn.disabled = false;
  }
}
```

---

## チェックリスト（PDF出力実装時）

- [ ] `from()` に渡す要素が `display:none` になっていないか確認
- [ ] タブ UI がある場合、PDF 生成前にアクティブパネルを変数保存しているか
- [ ] `finally` でのパネル復元順序: 全リセット → アクティブパネル再表示
- [ ] 外部 API/CDN から `<img>` を遅延読み込みしている場合は完了待機を実装
- [ ] `html2canvas` に `scrollX:0, scrollY:0` を指定
- [ ] `useCORS: true` で外部画像の CORS 許可

---

## 適用ファイル
- `haiku-engineering.html`（C4モデル研究会® 俳句フェースシート）
- 修正日: 2025-05-10
- バグ報告: PDF出力結果が6ページすべて白紙
