// 文章保存/加载体验流程测试
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", msg => {
    if (msg.type() === "error") errors.push("console.error: " + msg.text());
  });

  console.log("=== 0. 登录 ===");
  await page.goto("http://localhost:5175/");
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const r = await fetch("http://127.0.0.1:8085/api/collections/users/auth-with-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: "user001@geo.local", password: "test1234" }),
    });
    const j = await r.json();
    if (j && j.token) {
      localStorage.setItem("geo_auth", JSON.stringify({ token: j.token, record: j.record, email: "user001@geo.local" }));
    }
  });
  await page.reload();
  await page.waitForTimeout(2000);
  await page.waitForFunction(() => typeof state !== "undefined" && state.products && state.products.length > 0, { timeout: 10000 }).catch(() => {});

  console.log("\n=== 1. 打开 workshop 视图 ===");
  await page.evaluate(() => { if (typeof showView === "function") showView("workshop"); });
  await page.waitForTimeout(500);

  console.log("\n=== 2. 切换到生成 Tab ===");
  await page.evaluate(() => { if (typeof switchSubTab === "function") switchSubTab("generate"); });
  await page.waitForTimeout(500);

  console.log("\n=== 3. 填写文章标题/正文 ===");
  await page.evaluate(() => {
    document.getElementById("articleTitle").value = "测试文章-DraftTest";
    document.getElementById("articleTitle").dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("articleBody").value = "这是测试文章正文，用于测试草稿自动保存和恢复功能。";
    document.getElementById("articleBody").dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(1500); // 等 debounce 1s

  console.log("\n=== 4. 检查草稿是否已保存到 localStorage ===");
  const draft = await page.evaluate(() => {
    const raw = localStorage.getItem("geo_article_draft");
    return raw ? JSON.parse(raw) : null;
  });
  console.log("草稿:", draft ? { title: draft.title, bodyLen: (draft.body || "").length } : null);
  if (draft && draft.title) console.log("✓ 草稿已自动保存到 localStorage");
  else console.log("❌ 草稿未保存");

  console.log("\n=== 5. 检查草稿状态指示器 ===");
  const draftStatus = await page.evaluate(() => {
    const el = document.getElementById("articleDraftStatus");
    if (!el) return null;
    return { text: el.textContent, class: el.className };
  });
  console.log("草稿状态:", JSON.stringify(draftStatus));

  console.log("\n=== 6. 模拟刷新页面，验证草稿恢复 ===");
  await page.reload();
  await page.waitForTimeout(2000);
  await page.waitForFunction(() => typeof state !== "undefined" && state.products && state.products.length > 0, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => { if (typeof showView === "function") showView("workshop"); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { if (typeof switchSubTab === "function") switchSubTab("generate"); });
  await page.waitForTimeout(800);
  const restored = await page.evaluate(() => ({
    title: document.getElementById("articleTitle")?.value,
    body: document.getElementById("articleBody")?.value,
  }));
  console.log("恢复后:", { title: restored.title, bodyLen: (restored.body || "").length });
  if (restored.title === "测试文章-DraftTest") {
    console.log("✓ 草稿刷新后正确恢复");
  } else {
    console.log("❌ 草稿恢复失败");
  }

  console.log("\n=== 7. 手动保存文章到后端 ===");
  // 关联产品
  const productId = await page.evaluate(() => state.products[0]?.id);
  if (productId) {
    await page.evaluate((pid) => {
      document.getElementById("articleProduct").value = pid;
      document.getElementById("articleProduct").dispatchEvent(new Event("change", { bubbles: true }));
    }, productId);
  }
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById("saveArticleBtn")?.click());
  await page.waitForTimeout(2000);
  const savedArticles = await page.evaluate(() => {
    return (state.articles || []).filter(a => a.title === "测试文章-DraftTest").map(a => ({ id: a.id, title: a.title, status: a.status }));
  });
  console.log("已保存文章:", JSON.stringify(savedArticles));
  if (savedArticles.length > 0) console.log("✓ 文章已保存到后端");
  else console.log("❌ 文章未保存到后端");

  console.log("\n=== 8. 测试加载已保存的文章 ===");
  if (savedArticles.length > 0) {
    const articleId = savedArticles[0].id;
    const loadResult = await page.evaluate((id) => {
      try {
        // 找编辑按钮
        const editBtn = document.querySelector(`[data-id="${id}"].edit-article, [data-article-id="${id}"]`);
        return { hasEditBtn: !!editBtn, html: document.body.innerHTML.includes(id) };
      } catch (e) { return { err: e.message }; }
    }, articleId);
    console.log("加载测试:", JSON.stringify(loadResult));
  }

  console.log("\n=== 9. 清理：删除测试文章 ===");
  const cleanup = await page.evaluate(async (id) => {
    try {
      if (id && typeof api === "function") {
        await api(`/api/contents/${id}`, { method: "DELETE" });
        return { ok: true };
      }
      return { ok: false, reason: "no api or id" };
    } catch (e) { return { ok: false, err: e.message }; }
  }, savedArticles[0]?.id);
  console.log("清理:", JSON.stringify(cleanup));

  console.log("\n=== 10. 清理 localStorage 草稿 ===");
  await page.evaluate(() => localStorage.removeItem("geo_article_draft"));
  console.log("✓ 草稿已清除");

  console.log("\n=== 错误汇总 ===");
  if (errors.length === 0) console.log("✓ 无错误");
  else errors.forEach(e => console.log("•", e));

  await browser.close();
  console.log("\n=== 完成 ===");
})();
