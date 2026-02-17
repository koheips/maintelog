# メンテログ PWA

## 概要
端末内 localStorage のみで滞在ログを記録し 入力と履歴をタブで切替
JSON エクスポート インポートで端末移行
GitHub Pages で HTTPS 公開

## ファイル構成
- index.html
- app.js
- manifest.json
- sw.js
- icons/icon-192.png
- icons/icon-512.png

## GitHub Pages 公開手順
1 リポジトリを作成
2 リポジトリ直下に本一式を配置
3 GitHub の Settings -> Pages
4 Build and deployment の Source を Deploy from a branch に設定
5 Branch を main と /root に設定
6 Save
7 表示された URL にアクセスして動作確認

## iPhone ホーム画面追加手順
1 iPhone Safari で GitHub Pages の URL を開く
2 共有ボタン を選択
3 ホーム画面に追加 を選択
4 追加 を選択

## 更新反映 キャッシュ対策
PWA は Service Worker により 古いファイルが残りやすい
本プロジェクトは sw.js のキャッシュ名に版を含め 旧キャッシュを自動削除
それでも反映されない場合は次を実施
- Safari で対象 URL を開き 画面を下に引いて更新
- それでも残る場合 ホーム画面のアイコンを削除し もう一度 ホーム画面に追加
- 端末設定 -> Safari -> 詳細 -> Web サイトデータ から当該サイトを削除

## データ保存と移行
- 保存先 localStorage のみ
- GitHub へ利用データは保存しない
- 入力画面の JSON 保存 でバックアップを作成
- 復元 で JSON を読み込み

## 既存データ互換
- 既存の rows は maintelog_rows_v2 を使用
- 既存の tasks は maintelog_tasks_v2 を使用
- tasks が旧形式 文字列配列 の場合 読み込み時にオブジェクトへ昇格

## アイコンの差し替え方法
icons/icon-192.png と icons/icon-512.png を差し替え
生成方法の例
- Keynote や PowerPoint で 512x512 の正方形スライドを作り PNG 書き出し
- Figma で 512x512 フレームを作り Export PNG
- 書き出した 512 を 192 にリサイズして別名保存

注意
- ファイル名は固定
- manifest.json と index.html の apple-touch-icon はこのパスを参照

## アプリ名について
- 画面内のアプリ名は 設定で変更可能
- ホーム画面の表示名は manifest.json の name short_name を編集して反映
