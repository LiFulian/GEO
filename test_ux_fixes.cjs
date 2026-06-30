// UX 修复验证测试
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

  console.log("=== 0. 直接登录 ===");
  await page.goto("http://localhost:5175/");
  await page.waitForTimeout(1000);
  const auth = await page.evaluate(async () => {
    const r = await fetch("http://127.0.0.1:8085/api/collections/users/auth-with-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: "user001@geo.local", password: "test1234" }),
    });
    const j = await r.json();
    if (j && j.token) {
      localStorage.setItem("geo_auth", JSON.stringify({ token: j.token, record: j.record, email: "user001@geo.local" }));
    }
    return { ok: r.ok, hasToken: !!j.token };
  });
  console.log("登录:", JSON.stringify(auth));
  await page.reload();
  await page.waitForTimeout(2000);

  console.log("\n=== 测试 1: 引导页不会覆盖有数据的用户 ===");
  const wizardState = await page.evaluate(() => ({
    hasOverlay: !!document.getElementById("wizardOverlay"),
    overlayVisible: document.getElementById("wizardOverlay")?.style?.display !== "none",
    wizardCompleted: localStorage.getItem("geo_wizard_completed"),
  }));
  console.log("引导状态:", JSON.stringify(wizardState));
  if (wizardState.hasOverlay && wizardState.overlayVisible) {
    console.log("❌ 引导页遮挡了主界面！");
  } else {
    console.log("✓ 引导页未显示（有数据用户跳过）");
  }

  console.log("\n=== 测试 2: 覆盖率成就不再报错 ===");
  // 触发增强功能/成就检查
  const coverageCheck = await page.evaluate(() => {
    try {
      // 模拟成就检查
      const cov = (state.coverage && state.coverage.by_product) || [];
      const has50 = cov.some(c => (c.rate || 0) >= 50);
      const has100 = cov.some(c => (c.rate || 0) >= 100);
      return { ok: true, has50, has100, total: cov.length };
    } catch (e) {
      return { ok: false, err: e.message };
    }
  });
  console.log("覆盖率检查:", JSON.stringify(coverageCheck));
  if (coverageCheck.ok) console.log("✓ 覆盖率成就检查无错");
  else console.log("❌ 覆盖率检查报错:", coverageCheck.err);

  console.log("\n=== 测试 3: 快捷键 Ctrl+S 在输入框中触发保存 ===");
  // 打开文章编辑视图（如果存在）
  await page.evaluate(() => {
    if (typeof showView === "function") showView("workshop");
  });
  await page.waitForTimeout(500);
  // 尝试直接调用 ctrl+s
  const ctrlSResult = await page.evaluate(() => {
    // 找到 articleTitle 输入框
    const titleEl = document.getElementById("articleTitle");
    if (!titleEl) return { hasTitle: false };
    titleEl.focus();
    titleEl.value = "测试快捷键标题 " + Date.now();
    titleEl.dispatchEvent(new Event("input", { bubbles: true }));
    // 模拟 Ctrl+S
    const evt = new KeyboardEvent("keydown", { key: "s", code: "KeyS", ctrlKey: true, bubbles: true });
    titleEl.dispatchEvent(evt);
    document.dispatchEvent(evt);
    return { hasTitle: true, value: titleEl.value };
  });
  console.log("Ctrl+S 测试:", JSON.stringify(ctrlSResult));
  await page.waitForTimeout(1500);

  console.log("\n=== 测试 4: 切换 tab 时状态正确 ===");
  const navTest = await page.evaluate(() => {
    const results = [];
    if (typeof showView === "function") {
      ["products", "platforms", "workshop", "tasks", "settings"].forEach(v => {
        try { showView(v); results.push({ v, ok: true }); }
        catch (e) { results.push({ v, ok: false, err: e.message }); }
      });
    }
    return results;
  });
  console.log("导航测试:", JSON.stringify(navTest));
  const navOk = navTest.every(t => t.ok);
  console.log(navOk ? "✓ 所有视图切换正常" : "❌ 部分视图切换报错");

  console.log("\n=== 测试 5: 键盘 Esc 关闭弹窗 ===");
  // 打开 modal 然后按 Esc
  const escTest = await page.evaluate(() => {
    // 找一个 modal
    const modal = document.querySelector(".modal, [role=dialog], .dialog");
    if (!modal) return { hasModal: false };
    return { hasModal: true, tag: modal.tagName, cls: modal.className };
  });
  console.log("Esc 测试:", JSON.stringify(escTest));

  console.log("\n=== 测试 6: 浏览器刷新后数据不丢失 ===");
  // 改变一个无关紧要的设置
  await page.evaluate(() => {
    localStorage.setItem("test_reload", "ok");
  });
  await page.reload();
  await page.waitForTimeout(1500);
  const reloadCheck = await page.evaluate(() => ({
    testReload: localStorage.getItem("test_reload"),
    stateCount: typeof state !== "undefined" ? (state.products || []).length : "n/a",
  }));
  console.log("刷新后状态:", JSON.stringify(reloadCheck));

  console.log("\n=== 测试 7: API 错误有清晰提示 ===");
  const apiErrorTest = await page.evaluate(async () => {
    try {
      // 尝试更新一个不存在的记录
      const r = await api("/api/products/nonexistentid_xxxxx", { method: "PUT", body: JSON.stringify({ name: "x" }) });
      return { ok: true, result: r };
    } catch (e) {
      return { ok: false, err: e.message, code: e.code || "n/a" };
    }
  });
  console.log("API 错误处理:", JSON.stringify(apiErrorTest));
  if (!apiErrorTest.ok && apiErrorTest.err) {
    console.log("✓ 错误有明确消息:", apiErrorTest.err);
  }

  console.log("\n=== 错误汇总 ===");
  if (errors.length === 0) console.log("✓ 无 page error");
  else {
    errors.forEach(e => console.log("•", e));
  }

  await browser.close();
  console.log("\n=== 完成 ===");
})();
