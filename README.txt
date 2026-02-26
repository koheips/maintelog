このZIPは index.html の参照先を クエリ付きに変更するための差し替え用スニペットです

手順
1 GitHub の Code タブで index.html を開く
2 右上 Edit で編集
3 ファイル末尾付近の <script src="app.js"></script> を探す
4 本ZIPの snippet_index_tail.html の内容へ置き換える
5 serviceWorker 登録が別の場所にある場合も 同様に sw.js?v=... へ変更する
6 Commit changes

注意
・ v= の値は 更新のたびに必ず変更
・ localStorage の内容は維持される
