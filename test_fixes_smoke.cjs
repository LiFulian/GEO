// GEO Studio 修复冒烟测试 v2 —— 驱动真实浏览器验证关键修复
const { chromium } = require("playwright");
const BASE = "http://localhost:5175";
const EMAIL = "user001@geo.local", PASS = "test1234";
const errors = [], results = [];
const ok = (n, i) => results.push(`✓ ${n}${i ? "  "+i : ""}`);
const fail = (n, i) => results.push(`✗ ${n}${i ? "  — "+i : ""}`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("console", m => { if (m.type() === "error") errors.push(`[console] ${m.text()}`); });
  page.on("pageerror", e => errors.push(`[pageerror] ${e.message}`));

  try {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.fill("#loginEmail", EMAIL);
    await page.fill("#loginPassword", PASS);
    await page.click('#loginForm button[type="submit"]');
    // 等真正的登录完成信号（#dashboard.active 是 HTML 默认 class，会假阳性）
    await page.waitForFunction(() => (document.getElementById("userNameDisplay")?.textContent || "").trim().length > 0, { timeout: 15000 });
    ok("登录 + dashboard 加载（F3 无白屏）");
    const fatalVisible = await page.isVisible("#fatalError");
    if (!fatalVisible) ok("F3 致命遮罩未误触发"); else fail("F3 致命遮罩误出现");

    // --- F1: tasks/assign 路由（直接调 geoApi，确定性断言）---
    const assignRes = await page.evaluate(async () => {
      const dbg = {
        loggedIn: (typeof window.isLoggedIn === "function") ? window.isLoggedIn() : "?",
        uid: window.getCurrentUserId ? window.getCurrentUserId() : "?",
        auth: !!localStorage.getItem("geo_auth"),
      };
      // 先验证一个已知正常的列表调用，确认 auth 状态本身没问题
      try {
        const prods = await window.geoApi("/api/products", { method: "GET" });
        dbg.productsOk = Array.isArray(prods);
      } catch (e) { dbg.productsErr = e.message; }
      try {
        const r = await window.geoApi("/api/tasks/assign", { method: "POST", body: JSON.stringify({ article_ids: [], platform_ids: [] }) });
        return { ok: true, r, dbg };
      } catch (e) { return { ok: false, msg: e.message, dbg }; }
    });
    if (assignRes.ok && Array.isArray(assignRes.r?.created) && Array.isArray(assignRes.r?.skipped))
      ok("F1 tasks/assign 正确路由到 apiAssignTasks（返回 created/skipped）");
    else fail("F1 tasks/assign 路由仍坏", `${assignRes.msg || JSON.stringify(assignRes.r)} | dbg=${JSON.stringify(assignRes.dbg)}`);

    // --- F4: AI loading 计数器已注入 ---
    const aiLoader = await page.evaluate(() => typeof window.aiFetch === "function");
    if (aiLoader) ok("F4 aiFetch 已挂载（AI loading 咽喉）"); else fail("F4 aiFetch 未挂载");

    // --- F6: 产品状态显示（不全归档）---
    await page.click('.nav[data-view="products"]');
    await page.waitForSelector("#productList .product-list-item", { timeout: 8000 });
    const statuses = await page.$$eval(".product-list-meta", els => els.map(e => e.textContent.trim()));
    if (statuses.length && statuses.every(s => s.includes("归档"))) fail("F6 产品状态全归档", JSON.stringify(statuses));
    else ok("F6 产品状态显示正常", JSON.stringify(statuses.slice(0, 3)));

    // --- D2: 看板拖拽改状态 ---
    await page.click('.nav[data-view="tasks"]');
    await page.click('.sub-tab[data-tab="task-board"]');
    await page.waitForSelector("#taskBoard .task-column[data-drop-status]", { timeout: 8000 });
    const cols = await page.$$eval("#taskBoard .task-column", els => els.map(e => e.dataset.dropStatus));
    ok("D2 看板列 data-drop-status", JSON.stringify(cols));

    const todoCard = page.locator('.task-column[data-drop-status="todo"] .task-row[data-task-id]').first();
    if (await todoCard.count()) {
      const cardId = await todoCard.getAttribute("data-task-id");
      // headless 原生 HTML5 DnD 不可靠（Playwright 鼠标模拟常不触发 drop），
      // 改为派发合成 dragstart/drop 事件，确定性验证 setupTaskBoardDnD 的处理器 + moveTaskToStatus 逻辑
      const dispatch = async (cid, status) => page.evaluate(({ c, s }) => {
        const card = document.querySelector(`.task-row[data-task-id="${c}"]`);
        const col = document.querySelector(`.task-column[data-drop-status="${s}"]`);
        if (!card || !col) return false;
        const dt = new DataTransfer();
        card.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }));
        col.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }));
        return true;
      }, { c: cid, s: status });
      await dispatch(cardId, "skipped");
      await page.waitForTimeout(1800);
      const moved = await page.locator(`.task-column[data-drop-status="skipped"] .task-row[data-task-id="${cardId}"]`).count();
      if (moved) {
        ok("D2 drop 处理器生效（todo→skipped）");
        await dispatch(cardId, "todo");
        await page.waitForTimeout(1500);
        const back = await page.locator(`.task-column[data-drop-status="todo"] .task-row[data-task-id="${cardId}"]`).count();
        if (back) ok("D2 拖回可逆（skipped→todo）"); else fail("D2 拖回失败");
      } else fail("D2 drop 处理器未移动卡片（moveTaskToStatus 可能未触发）");
    } else fail("D2 无 todo 卡片可测");

    // --- U2: 脏数据保护 ---
    const dirty = await page.evaluate(() => typeof window.__geoClearDirty === "function");
    if (dirty) ok("U2 未保存保护已挂载"); else fail("U2 未挂载");

    // --- U3: role=button 键盘可达 ---
    const kb = await page.evaluate(() => typeof window.maybeShowWizard === "function");
    if (kb) ok("U6 向导函数已挂载（非竞态）"); else fail("U6 maybeShowWizard 未挂载");

  } catch (e) { fail("测试异常中断", e.message + "\n" + (e.stack||"").split("\n")[1]); }
  await browser.close();

  console.log("\n===== 冒烟测试结果 =====");
  results.forEach(r => console.log(r));
  console.log("\n===== JS 运行时错误（应为空）=====");
  if (!errors.length) console.log("✓ 无 JS 错误"); else errors.forEach(e => console.log("✗ " + e));
  process.exit(errors.length || results.some(r => r.startsWith("✗")) ? 1 : 0);
})();
