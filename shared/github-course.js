export const GITHUB_PRACTICE = "https://github.com/No-genai/git_practice";
export const GITHUB_STEPS = [
  {
    id: "browse",
    title: "1. リポジトリとファイルを見る",
    summary:
      "リポジトリは、ファイルと変更履歴をまとめた場所です。GitHubのCodeタブでファイルを開き、Commitsから変更履歴を確認できます。",
    practice:
      "git_practiceのindex.htmlを開き、見出しを探しましょう。実際に編集する練習は、自分のアカウントへForkしたコピーで行います。Forkできない場合は、自分の練習用リポジトリに小さなHTMLファイルを作って進められます。",
    commands: "",
    check: "Codeタブでindex.htmlを開ければ、この章の操作はOK。",
    source:
      "https://docs.github.com/ja/repositories/creating-and-managing-repositories/about-repositories",
  },
  {
    id: "clone",
    title: "2. PCにクローンする",
    summary:
      "cloneは、GitHubにあるリポジトリを履歴ごとPCへ複製する操作です。PCでGitが使えることを確認し、自分のリポジトリのCode → HTTPSからURLをコピーします。",
    practice:
      "下のYOUR_ACCOUNTは自分のGitHubユーザー名に置き換えます。コマンドはPCのターミナルで1行ずつ実行します。このアプリからPCのコマンドを実行することはありません。非公開リポジトリでは自分のアカウントで認証してください。",
    commands:
      "git --version\ngit clone https://github.com/YOUR_ACCOUNT/git_practice.git\ncd git_practice\ngit remote -v",
    check:
      "git remote -vのoriginが自分の練習用リポジトリを指しているか確認しましょう。",
    source:
      "https://docs.github.com/ja/repositories/creating-and-managing-repositories/cloning-a-repository",
  },
  {
    id: "edit",
    title: "3. 編集して差分を確認する",
    summary:
      "ファイルを保存しただけでは、Gitの履歴には記録されません。git statusで変更されたファイル、git diffで変更内容を確認します。",
    practice:
      "練習用ブランチpractice/introを作り、エディタでindex.htmlに「<p>GitHubを練習しています</p>」を追加して保存します。ブランチは作業を分ける仕組みで、第5章でも確認します。同名ブランチが既にある場合はgit switch practice/introで移動してください。",
    commands: "git switch -c practice/intro\ngit status\ngit diff",
    check: "git diffで、自分が追加した1行を見つけられますか？",
    source:
      "https://git-scm.com/book/ja/v2/Git-の基本-変更内容のリポジトリへの記録",
  },
  {
    id: "commit",
    title: "4. コミットしてプッシュする",
    summary:
      "addは記録する変更を選ぶ、commitはPCの履歴に記録する、pushはGitHubへ送る操作です。commitだけではGitHub上のファイルは変わりません。",
    practice:
      "index.htmlだけをステージし、差分を確認してコミットします。push前にoriginが自分のリポジトリか確認してください。認証を求められたらGitHubの案内に従います。パスワードやトークンをコードやチャットへ貼る必要はありません。",
    commands:
      'git add index.html\ngit diff --staged\ngit commit -m "Add practice introduction"\ngit remote -v\ngit push -u origin practice/intro',
    check: "GitHubでpractice/introブランチを選び、追加した文を確認しましょう。",
    source:
      "https://docs.github.com/ja/get-started/using-git/pushing-commits-to-a-remote-repository",
  },
  {
    id: "pr",
    title: "5. ブランチとプルリクエスト",
    summary:
      "ブランチで変更を分け、プルリクエスト（PR）で「この変更を取り込みたい」と提案します。PRでは差分を確認したりコメントしたりできます。",
    practice:
      "GitHubのPull requests → New pull requestを開きます。練習ではbase repositoryも自分のリポジトリにして、baseをmain、compareをpractice/introにします。元のNo-genaiリポジトリへ送る設定になっていないか確認しましょう。変更内容が分かるタイトルを書いてPRを作成します。",
    commands: "git branch --show-current",
    check:
      "PRのFiles changedに、自分が変更したindex.htmlだけが表示されていますか？",
    source:
      "https://docs.github.com/ja/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request",
  },
  {
    id: "merge",
    title: "6. 確認してマージする",
    summary:
      "マージは、提案した変更をbaseブランチへ取り込む操作です。差分・チェック結果・コメントを確認してから実行します。PRを作っただけでは取り込まれません。",
    practice:
      "自分の練習用リポジトリのPRを確認してマージし、GitHubのmainで追加した文を確認します。最後にローカルのmainを更新します。未コミットの変更がある場合は先に確認・整理してください。競合や失敗が出たら強制実行せず、表示された内容を確認しましょう。",
    commands: "git status\ngit switch main\ngit pull --ff-only origin main",
    check: "GitHubとPCのmainの両方で変更が見えれば、一連の基本操作は完了です。",
    source:
      "https://docs.github.com/ja/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request",
  },
];
