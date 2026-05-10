---
name: haiku-engineering-c4
description: >
  Use this skill when working on the haiku-engineering.html project (俳句の科学入門 /
  Haiku Science, c4model.org). Covers: fixing PlantUML diagram load failures,
  adding/modifying C4 diagrams (L1–L3), sequence diagrams, and state diagrams
  via kroki.io, updating author profile content, and general maintenance of this
  HTML single-file application. Trigger when the user mentions haiku-engineering.html,
  C4図の読み込みエラー, kroki.io, PlantUML rendering, or 著者プロフィール for this page.
license: C4モデル研究会® · 奥村治 (Osamu Okumura) · All rights reserved
---

# haiku-engineering.html — メンテナンス・スキル

このスキルは `haiku-engineering.html`（俳句の科学入門, c4model.org）の保守・改修に使用する。

## ファイル概要

| 項目 | 内容 |
|------|------|
| ファイル名 | `haiku-engineering.html` |
| 性質 | 単一ファイル HTML アプリ（CSS/JS 内包） |
| フォント | Fraunces / DM Mono / Source Serif 4 |
| 主な依存 | kroki.io (PlantUML), Anthropic API, html2pdf.js |

---

## 既知のバグと修正済み対策

### バグ①: 「図の読み込みに失敗しました」エラー（根本修正済み）

**原因:**
- `renderPuml()` が `plantuml.com` への GET リクエストをプライマリとしていた。
- `!include` で GitHub Raw コンテンツを参照する PUML + 日本語テキストが含まれると、
  plantuml.com 側のエンコード失敗・CORS エラー・タイムアウトが頻発する。
- kroki.io はフォールバックにのみ存在したため、プライマリ失敗時のみ試行されていた。

**修正内容 (2025-05-10):**
```javascript
// ✅ kroki.io POST をプライマリに昇格
fetch('https://kroki.io/plantuml/svg', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Accept': 'image/svg+xml' },
  body: puml
})
.then(r => r.blob()).then(blob => showImg(URL.createObjectURL(blob)))
.catch(() => tryPlantuml()); // フォールバック: plantuml.com GET
```

**再発防止策:**
- 新しい図を追加する際は必ず kroki.io POST 経由でテストすること
- `!include` 行は C4-PlantUML stdlib の URL のまま維持してよい（kroki.io は内部処理可能）
- `img.src` に直接 URL を指定せず、必ず `URL.createObjectURL(blob)` 経由で設定する

---

### バグ②: C4デモセクションにシーケンス図・状態遷移図タブが未実装（修正済み）

**修正内容:**
- `diagram-tabs` に「シーケンス図」「状態遷移図」ボタンを追加
- `panel-seq`, `panel-sta` のHTMLパネルを追加
- `PUML_SEQ`, `PUML_STA` の PlantUML 定義を追加
- `panels` オブジェクト・`loadDiagram` マップに `seq`, `sta` を追加

---

## PlantUML 図の構成（C4デモセクション）

| キー | ID | 内容 |
|------|----|------|
| `ctx` | `puml-ctx` | L1 Context — 読者とシステム境界 |
| `ctr` | `puml-ctr` | L2 Container — 3句のコンテナ構造 |
| `cmp` | `puml-cmp` | L3 Component — 第2・3句の工学的分解 |
| `seq` | `puml-seq` | シーケンス図 — 読者の認知プロセス時系列 |
| `sta` | `puml-sta` | 状態遷移図 — 読者の感情状態変化 |

---

## 著者プロフィール（最終更新: 2025-05-10）

```
bio: C4モデルシステムコンサルタント。俳句の科学（Haiku Science）と俳句システム研究会を主宰し、
     松尾芭蕉・小林一茶の作品をC4モデルで構造分析する研究・創作活動を推進している。
     「図でみる俳句」シリーズをYouTubeで公開。Amazon Kindle著作多数。
     学術論文の執筆支援システム「論文道場」を開発・運営。

career:
  現在:  C4モデルシステムコンサルタント・C4モデル研究会® 主宰
  前職:  大阪ガスシンクタンク 関西新技術研究所（KRI）事業戦略主席コンサルタント
  前々職: 電通PRコンサルティング 企画調査局ディレクター
  学歴:  Newport University Ph.D. / 都立産業技術大学院大学（AIIT）M.S. / 中央大学 B.A.
  学会:  日本図書館学会 会員
```

---

## 修正時の注意点

1. **PlantUML PUML 変数名**: `PUML_CTX`, `PUML_CTR`, `PUML_CMP`, `PUML_SEQ`, `PUML_STA`
2. **タブ切替関数**: `switchTab(key)` — key は `ctx/ctr/cmp/seq/sta`
3. **Facesheet の C4タブ**: `switchPdfTab(key, btn)` — 出力エリア用の別関数
4. **PDF出力バグ修正**: バグ①②③は `exportPDF()` 内の finally ブロックで対処済み
5. **AI生成 PlantUML**: `buildPumlPrompt()` が seq/sta を含む5種を Claude API で生成

