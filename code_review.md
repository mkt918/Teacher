# 📋 コードレビュー — 教員業務支援アプリ

> レビュー対象: `c:\Program1\Teacher` プロジェクト全体  
> レビュー日: 2026-03-02

---

## 🟢 良い点

### アーキテクチャ

- **モジュール分離が明確**: `StorageManager` / `Router` / `App` / 各モジュールの役割が分かれている
- **`initialized` フラグによる二重初期化防止**: 多くのモジュールで `if (this.initialized) return;` を使用しており堅牢
- **`BaseModule` クラス**: 共通処理（印刷・D&D・履歴）を集約しており、再利用設計の意識が高い
- **`EventBus` の準備**: モジュール間疎結合の基盤が整っているが現時点では未活用
- **デバウンス付きオートセーブ**: 1秒デバウンス＋ `beforeunload` で確実に保存される設計
- **日付フォーマット統一**: `YYYY-MM-DD` 形式で統一

---

## 🟡 改善推奨事項

### 1. `_formatDate` が2箇所に重複定義されている【重要】

**ファイル**: `js/modules/schedule/index.js`

```javascript
// L217-L222 (padStart版)
_formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    ...
}

// L583-L585 (toISOString版 — 重複定義！)
_formatDate(date) {
    return date.toISOString().split('T')[0];
}
```

**問題**: 同一オブジェクト内で `_formatDate` が2回定義されており、後者（L583）が前者（L217）を上書きする。`toISOString()` はUTC時刻ベースなため、日本時間の夜23時以降にズレが発生しうる。

**修正案**:

```javascript
// 上の定義（L217）を削除し、下の定義を padStart版に統一
_formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
```

---

### 2. `_isToday` も同一ファイルで重複定義

**ファイル**: `js/modules/schedule/index.js` (L224-L229 と L587-L592)

内容は同一なので、片方を削除するだけでOK。

---

### 3. `onclick` 属性インライン混在（一貫性の欠如）

**ファイル**: `index.html` (L255, L285-L288), `js/app.js` (L284-L285)

```html
<!-- HTMLに直接書かれたonclick -->
<button onclick="SeatingModule.arrangeByNumber()">番号順に並べる</button>
<button onclick="MeetingModule.printScheduleA4('number')">🖨️ 番号のみ</button>
```

```javascript
// JS側で document.createElement したHTMLにも onclick="App.loadState(...)"
`<button onclick="App.loadState(${save.slot})">読み込み</button>`
```

同一プロジェクトで `addEventListener` と `onclick` 属性が混在している。テストしにくく、CSPポリシーにも引っかかりやすい。イベントデリゲーションや `addEventListener` に統一することが望ましい。

---

### 4. `router.js` の `onPageChange` — `init()` を毎回呼ぶ問題

**ファイル**: `js/router.js` (L103-L183)

```javascript
case 'seating':
    SeatingModule.init?.();   // ← initialized フラグで保護されているが…
    SeatingModule.render();
    break;
```

`init()` はフラグで守られているが、`render()` は毎回呼ばれる。一部のモジュール（`BusModule` など）では `loadBuses()` + `render()` が毎回実行される。ページサイズが大きい場合はパフォーマンス影響がある。データが変わっていない場合の再描画をスキップするダーティフラグを検討。

---

### 5. `StorageManager` → `getAllData()` の頻繁な呼び出し

**ファイル**: `js/storage.js`

`saveAutoSave()`, `saveStateSave()`, `deleteStateSave()` など、書き込みのたびに `getAllData()`（= `JSON.parse(localStorage.getItem(...))`）を呼んでいる。`localStorage` の読み書きは同期処理かつ比較的遅い。`allData` をメモリにキャッシュしておき、変更時のみ `localStorage` に書き込む方式が良い。

---

### 6. `base-module.js` の `export` が実質未使用

**ファイル**: `js/core/base-module.js`

```javascript
export class BaseModule { ... }
```

`index.html` はすべて `<script src="...">` で読み込んでおり、ES Modules (`type="module"`) を使っていない。`export` しても `import` されないため、`window.BaseModule` によるグローバル公開のみが有効になっている。`EventBus` も同様。ES Modules に移行するか、`export` を削除して明確化するか、どちらかに統一が必要。

---

### 7. `openStudentAttendanceModal` 内の ID 競合リスク

**ファイル**: `js/modules/attendance/index.js` (L416)

```javascript
// 毎回同じIDのモーダルを body に append
modal.id = 'attendanceModal';
document.body.appendChild(modal);
```

モーダルを `document.createElement` で都度生成しているが、ID が固定のため、万が一2回開かれた場合（ダブルクリック等）に同一IDが複数存在する。`openDayDetailModal` の中で `prevMonthBtn`/`nextMonthBtn` を `document.getElementById` で取得しているが、カレンダーモーダルでも同じIDを使っており (`id="prevMonthBtn"`)、年間行事ページの同IDと**衝突**する可能性がある。

**修正案**: モーダル内のIDにユニークなサフィックスを付けるか、`modal.querySelector(...)` でスコープを絞る。

---

### 8. `attendance/index.js` の時限数ハードコード

```javascript
for (let p = 1; p <= 6; p++) { ... }  // L103, L279, L608, L620
```

`periodsPerDay` の設定を参照している箇所とハードコード `6` を直接使っている箇所が混在。設定変更時（例: 水曜日を4限にした場合）に不整合が生じる。

---

### 9. `index.html` の大量インラインスタイル

約 993 行の HTML 内に `style="..."` が多数混在している。例:

```html
<div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px;">
<span style="font-size: 0.6em; font-weight: normal; margin-left: 10px; color: #64748b;">
```

CSS ファイルにクラスとして切り出すことでメンテナンス性が向上する。

---

### 10. `App.renderStateSaveList` で存在しない要素ID を参照

**ファイル**: `js/app.js` (L267)

```javascript
const container = document.getElementById('stateSaveList');
if (!container) return; // 要素が存在しない場合は何もしない
```

`settingsModal` 内には `stateSaveList` という ID が存在しない（`stateLoadList` と `autoSaveList` のみ）ため、常に `null` を返して何もしない状態になっている。デッドコードになっている可能性が高い。

---

## 🔴 バグ疑い

### `schedule/index.js` — `_formatDate` 上書きによるタイムゾーンバグ

上記「改善推奨事項 1」で述べた通り、後に定義された `toISOString()` 版が有効になるため、日本時間23時以降に入力すると翌日の日付として保存される可能性がある。

---

### `attendance/index.js` — ID衝突

`id="prevMonthBtn"` は年間行事ページ (`page-calendar`) の `<button id="prevMonthBtn">` と衝突している（`index.html` L494）。`openStudentAttendanceModal` 内でこのIDに `addEventListener` すると、カレンダーページのボタンが壊れる可能性がある。

---

## 📊 総評

| 観点 | 評価 | コメント |
|------|------|---------|
| モジュール設計 | ⭐⭐⭐⭐ | 分離はよくできている |
| コードの一貫性 | ⭐⭐⭐ | onclick/addEventListener混在・export未使用など |
| バグリスク | ⭐⭐ | `_formatDate`重複・ID衝突が実害になりうる |
| パフォーマンス | ⭐⭐⭐ | `localStorage`頻繁読み書き・毎回再描画は改善余地あり |
| 保守性 | ⭐⭐⭐ | インラインスタイル多め・ハードコードあり |

---

## 🛠️ 優先対応リスト

1. **🔴 緊急** `schedule/index.js` の `_formatDate` 重複定義を削除（タイムゾーンバグ）
2. **🟠 高** `attendance` モーダル内の `prevMonthBtn` / `nextMonthBtn` IDをスコープ付きに変更
3. **🟡 中** `onclick` 属性を `addEventListener` に統一
4. **🟡 中** 時限数ハードコード `6` を設定値参照に置換
5. **🔵 低** `BaseModule` / `EventBus` のモジュール方式を統一（ES Modules or グローバル変数）
6. **🔵 低** `App.renderStateSaveList` のデッドコード調査・削除
