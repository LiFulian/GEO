/* GEO Studio - Event binding with event delegation */

// 搜索索引缓存（模块级，便于 state.js 在 load() 后通过全局 clearSearchIndexCache 清除）
let _searchIndexCache = null;
let _searchIndexCacheKey = null;

// 清除搜索索引缓存（在 load() 后调用）
// 注意：必须位于 bindEvents() 外的顶层作用域，否则 state.js 的
// typeof clearSearchIndexCache === "function" 判定为 false，索引永不刷新
function clearSearchIndexCache() {
  _searchIndexCache = null;
  _searchIndexCacheKey = null;
}

function bindEvents() {
  // --- Auth ---
  renderAuthView();

  $("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await userLogin($("#loginEmail").value, $("#loginPassword").value);
      hideAuthView();
      await load();
      if (typeof initRouter === "function") initRouter();
      toast("登录成功", "success");
    } catch (err) { toast(err.message, "error"); }
  });

  $("#registerForm").addEventListener("submit", async event => {
    event.preventDefault();
    const pw = $("#regPassword").value;
    const pw2 = $("#regPasswordConfirm").value;
    if (pw !== pw2) return toast("两次密码不一致", "error");
    try {
      await userRegister($("#regEmail").value, pw, $("#regName").value);
      hideAuthView();
      await load();
      if (typeof initRouter === "function") initRouter();
      toast("注册成功，欢迎！", "success");
    } catch (err) { toast(err.message, "error"); }
  });

  $("#logoutBtn").addEventListener("click", () => {
    userLogout();
    state.products = []; state.geo_questions = []; state.platforms = [];
    state.articles = []; state.tasks = []; state.ai_settings = {};
    state.user_models = [];
    showAuthView();
    render();
  });

  $("#settingsBtn").addEventListener("click", () => showView("settings"));
  $("#currentModelLabel")?.addEventListener("click", () => showView("settings"));

  // Auth tabs
  $$("#authTabs .auth-tab").forEach(tab => tab.addEventListener("click", () => {
    $$("#authTabs .auth-tab").forEach(t => t.classList.toggle("active", t === tab));
    $("#loginForm").style.display = tab.dataset.tab === "login" ? "flex" : "none";
    $("#registerForm").style.display = tab.dataset.tab === "register" ? "flex" : "none";
  }));

  // Account selector chips
  renderAccountChips();
  $$("#accountChips .account-chip").forEach(chip => chip.addEventListener("click", () => {
    $$("#accountChips .account-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    $("#loginEmail").value = chip.dataset.email;
    $("#loginPassword").value = chip.dataset.password;
  }));

  // --- Navigation ---
  $$(".nav").forEach(btn => btn.addEventListener("click", () => {
    showView(btn.dataset.view);
  }));

  // --- Mobile Sidebar ---
  $("#sidebarToggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    $(".sidebar")?.classList.toggle("open");
    $("#sidebarOverlay")?.classList.toggle("show");
  });
  $("#sidebarOverlay")?.addEventListener("click", () => {
    $(".sidebar")?.classList.remove("open");
    $("#sidebarOverlay")?.classList.remove("show");
  });

  // --- Top Bar ---
  $("#refreshBtn").addEventListener("click", async () => {
    setLoading($("#refreshBtn"), true);
    try { await load(); } catch (e) { toast("刷新失败：" + e.message, "error"); }
    setLoading($("#refreshBtn"), false);
  });

  // 更多菜单（导入/导出备份）
  $("#moreMenuBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = $("#moreMenu");
    menu.style.display = menu.style.display === "none" ? "grid" : "none";
  });
  document.addEventListener("click", () => { $("#moreMenu") && ($("#moreMenu").style.display = "none"); });
  $("#moreMenu")?.addEventListener("click", (e) => e.stopPropagation());

  // 统计卡片点击跳转
  $$(".stat-clickable").forEach(el => el.addEventListener("click", () => {
    showView(el.dataset.jump);
  }));

  $("#exportBtn").addEventListener("click", async () => {
    try {
      const backup = await api("/api/backup");
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `geo-backup-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast("备份已导出", "success");
    } catch (e) {
      toast("导出失败：" + e.message, "error");
    }
  });

  $("#importBackupBtn").addEventListener("click", () => $("#backupFile").click());
  $("#backupFile").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    let backup;
    try {
      const text = await file.text();
      backup = JSON.parse(text);
    } catch (err) {
      toast("备份文件格式错误：" + err.message, "error");
      event.target.value = "";
      return;
    }

    if (!confirm(`确定导入备份？\n\n产品: ${backup.products?.length || 0}\nGEO问题: ${backup.geo_questions?.length || 0}\n文章: ${backup.articles?.length || 0}\n平台: ${backup.platforms?.length || 0}\n\n现有数据不会被覆盖，将追加导入。`)) {
      event.target.value = "";
      return;
    }

    const userId = getCurrentUserId();
    let imported = 0, skipped = 0, errors = 0;

    const importRecords = async (collection, records) => {
      if (!records || !Array.isArray(records)) return;
      for (const record of records) {
        const { id, collectionId, collectionName, created_at, updated_at, created, updated, expand, ...rest } = record;
        rest.user_id = userId;
        if (!rest.created_at) rest.created_at = created || new Date().toISOString();
        if (!rest.updated_at) rest.updated_at = updated || new Date().toISOString();
        try {
          await api(`/api/${collection}`, { method: "POST", body: JSON.stringify(rest) });
          imported++;
        } catch (e) {
          errors++;
          console.warn(`导入 ${collection} 失败：`, record.id || record.name || record.title, e.message);
        }
      }
    };

    toast("正在导入备份...");
    try {
      await importRecords("products", backup.products);
      await importRecords("geo_questions", backup.geo_questions);
      await importRecords("platforms", backup.platforms);
      await importRecords("articles", backup.articles);
      await importRecords("publish_tasks", backup.tasks);
      await importRecords("user_models", backup.user_models);

      // ai_settings: 仅导入设置，不覆盖 API Key
      if (backup.ai_settings && typeof backup.ai_settings === "object") {
        const { id, collectionId, collectionName, created_at, updated_at, created, updated, expand, ...rest } = backup.ai_settings;
        delete rest.text_api_key;
        delete rest.image_api_key;
        delete rest.api_key;
        rest.user_id = userId;
        try {
          await api("/api/ai_settings", { method: "POST", body: JSON.stringify(rest) });
          imported++;
        } catch (e) {
          errors++;
          console.warn("导入 ai_settings 失败：", e.message);
        }
      }

      toast(`备份导入完成：成功 ${imported} 条${errors ? "，失败 " + errors + " 条" : ""}`, errors ? "default" : "success");
      await load();
    } catch (err) {
      toast("导入过程中出错：" + err.message, "error");
    }

    event.target.value = "";
  });

  // --- Products ---
  $("#productForm").addEventListener("submit", async event => {
    event.preventDefault();
    const btn = event.submitter || $("#saveProductBtn");
    if (btn && isLoading(btn)) return;
    if (btn) setLoading(btn, true);
    try {
      const payload = formData(event.target);
      const id = payload.id;
      delete payload.id;
      let savedId = id;
      if (id) {
        await api(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        const created = await api("/api/products", { method: "POST", body: JSON.stringify(payload) });
        savedId = created.id;
      }
      toast("产品已保存", "success");
      await load();
      // 选中保存的产品，并以查看模式展示
      if (savedId) {
        selectProduct(savedId);
      }
    } catch (e) {
      toast("保存失败：" + e.message, "error");
    } finally {
      if (btn) setLoading(btn, false);
    }
  });

  // 取消编辑按钮
  $("#cancelProductBtn")?.addEventListener("click", () => {
    if (selectedProductId) {
      // 已有产品：返回查看模式
      const product = state.products.find(p => p.id === selectedProductId);
      if (product) renderProductDetail(product);
      else showProductViewMode();
    } else {
      // 新建取消：回到空状态
      resetProductForm();
    }
  });

  // 新增产品按钮
  $("#addProductBtn")?.addEventListener("click", () => {
    showProductEditMode({ id: "", name: "", type: "", url: "", audience: "", selling_points: "", competitors: "", tone: "真实、专业、克制", goal: "", forbidden_words: "" });
  });

  // 产品详情编辑按钮
  $("#productDetailEdit")?.addEventListener("click", () => {
    const product = state.products.find(p => p.id === selectedProductId);
    if (product) showProductEditMode(product);
  });

  // 产品详情删除按钮
  $("#productDetailDelete")?.addEventListener("click", async () => {
    if (!selectedProductId) return;
    if (!confirm("确定删除该产品？相关数据不会删除。")) return;
    try {
      await api(`/api/products/${selectedProductId}`, { method: "DELETE" });
      toast("产品已删除", "success");
      resetProductForm();
      await load();
    } catch (e) { toast("删除失败：" + e.message, "error"); }
  });

  // GEO 问题已扁平化到产品档案页面下方，无 Tab 切换

  // 深度编辑跳转
  $("#productGoToDetail")?.addEventListener("click", () => {
    if (selectedProductId) showProductDetail(selectedProductId);
  });

  // 生成内容快速跳转
  $("#productGoToWorkshop")?.addEventListener("click", () => {
    showView("workshop");
    const wp = $("#workshopProduct");
    if (wp) wp.value = selectedProductId;
  });
  $("#productSearch")?.addEventListener("input", debounce(renderProducts, 200));

  // --- Product Detail ---
  $("#pdSaveBtn")?.addEventListener("click", async () => {
    await saveProductFromForm({ showToast: true });
  });

  $("#pdBackBtn")?.addEventListener("click", () => {
    showView("products");
  });

  $("#pdDeleteBtn")?.addEventListener("click", async () => {
    const id = ($("#pdId")?.value) || "";
    if (!id) return toast("未选择产品", "error");
    if (!confirm("确定删除该产品？相关数据不会删除。")) return;
    try {
      await api(`/api/products/${id}`, { method: "DELETE" });
      toast("产品已删除", "success");
      showView("products");
      await load();
    } catch (e) { toast("删除失败：" + e.message, "error"); }
  });

  // 全字段自动保存 + 状态指示
  const pdFields = ["pdName", "pdType", "pdUrl", "pdStatus"];
  const autoSaveAll = debounce(() => saveProductFromForm({ showToast: false, silent: true }), 800);
  pdFields.forEach(id => {
    const el = $("#" + id);
    if (!el) return;
    el.addEventListener("input", () => { setPdSaveStatus("dirty"); autoSaveAll(); });
    el.addEventListener("change", () => { setPdSaveStatus("dirty"); autoSaveAll(); });
  });

  $("#pdMarkdown")?.addEventListener("input", () => {
    updateProductMdPreview();
    setPdSaveStatus("dirty");
  });
  $("#pdMarkdown")?.addEventListener("input", debounce(() => {
    saveProductFromForm({ showToast: false, silent: true, onlyDescription: true });
  }, 800));

  $$(".pd-view-btn").forEach(btn => btn.addEventListener("click", () => {
    $$(".pd-view-btn").forEach(b => b.classList.toggle("active", b === btn));
    const mode = btn.dataset.mode;
    if ($("#pdMarkdown")) $("#pdMarkdown").style.display = mode === "edit" ? "" : "none";
    if ($("#pdPreview")) $("#pdPreview").style.display = mode === "preview" ? "block" : "none";
  }));

  $("#pdUploadImageBtn")?.addEventListener("click", () => {
    let fileInput = $("#pdFileInput");
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.id = "pdFileInput";
      fileInput.accept = "image/*";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const productId = ($("#pdId")?.value) || "";
        if (!productId) { toast("请先保存产品", "error"); fileInput.value = ""; return; }
        const form = new FormData();
        form.append("image", file);
        form.append("product_id", productId);
        form.append("user_id", getCurrentUserId());
        const pbUrl = (window.__GEO_CONFIG__ && window.__GEO_CONFIG__.pbUrl) || "";
        try {
          const token = await apiAuth();
          const res = await fetch(`${pbUrl}/api/collections/product_images/records`, {
            method: "POST",
            headers: { Authorization: token },
            body: form,
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `上传失败 (HTTP ${res.status})`);
          }
          toast("图片已上传", "success");
          await load();
        } catch (err) { toast(err.message, "error"); }
        fileInput.value = "";
      });
    }
    fileInput.click();
  });

  // --- Product AI ---
  $("#productAiPromptBtn").addEventListener("click", async () => {
    const rawText = $("#productAiInput").value.trim();
    if (!rawText) return toast("请先输入产品描述", "error");
    const pid = $("#productId").value || "";
    const currentProduct = pid ? state.products.find(p => p.id === pid) : null;
    const prompt = buildProductProfilePrompt(rawText, currentProduct);
    $("#productAiResult").value = prompt;
    await copyToClipboard(prompt);
    toast("产品档案 Prompt 已生成并复制", "success");
  });

  $("#productAiDirectBtn").addEventListener("click", async () => {
    const btn = $("#productAiDirectBtn");
    if (isLoading(btn)) return;
    const rawText = $("#productAiInput").value.trim();
    if (!rawText) return toast("请先输入产品描述", "error");
    setLoading(btn);
    toast("正在梳理产品档案...");
    try {
      const aiSettings = state.ai_settings || {};
      if (!aiSettings.text_api_key) return toast("请先在「AI 设置」中配置文本模型 Key", "error");
      const pid = $("#productId").value || "";
      const currentProduct = pid ? state.products.find(p => p.id === pid) : null;
      const prompt = buildProductProfilePrompt(rawText, currentProduct);
      const result = await callAI(aiSettings, [
        { role: "system", content: "你是一个严谨的中文内容运营专家，只输出可解析 JSON。" },
        { role: "user", content: prompt },
      ]);
      const product = extractJsonObject(result);
      $("#productAiResult").value = JSON.stringify(product, null, 2);
      applyProductSuggestion(product);
      toast("已填入产品表单，请检查后保存", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

  $("#productAiApplyBtn").addEventListener("click", () => {
    try {
      applyProductSuggestion(extractJsonObject($("#productAiResult").value));
      toast("已应用到产品表单", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  // --- AI Chat ---
  $("#pdChatSend")?.addEventListener("click", sendPdChatMessage);
  $("#pdChatInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPdChatMessage();
    }
  });

  // --- Product Detail Tabs (深度编辑页已无 Tab，保留空实现以兼容) ---
  // section#productDetail 已简化为单一面板，无需 Tab 切换

  // --- GEO Questions (in product detail) ---
  $("#pdGeoToggleForm")?.addEventListener("click", () => {
    resetGeoQuestionForm();
    $("#geoQuestionForm").style.display = "";
    $("#geoQuestionText")?.focus();
  });
  $("#pdGeoCheckAllBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const productId = ($("#pdId")?.value) || selectedProductId;
    if (!productId) { toast("请先选择产品", "error"); return; }
    if (isLoading(btn)) return;
    setLoading(btn, true);
    try { await doRankCheckBatch(productId); }
    finally { setLoading(btn, false); }
  });
  $("#cancelGeoQuestionBtn")?.addEventListener("click", () => {
    $("#geoQuestionForm").style.display = "none";
    resetGeoQuestionForm();
  });

  $("#geoQuestionForm").addEventListener("submit", async event => {
    event.preventDefault();
    const btn = event.submitter || event.target.querySelector('button[type="submit"]');
    if (btn && isLoading(btn)) return;
    if (btn) setLoading(btn, true);
    try {
      const id = $("#geoQuestionId").value;
      const payload = {
        product_id: $("#geoProduct").value || $("#pdId").value || "",
        question: $("#geoQuestionText").value,
        intent: $("#geoIntent").value,
        audience: $("#geoAudience").value,
        priority: $("#geoPriority").value,
        status: $("#geoStatus").value,
        content_angle: $("#geoAngle").value,
        target_platform: $("#geoPlatform").value,
      };
      if (!payload.product_id) return toast("请先保存产品", "error");
      if (id) {
        await api(`/api/geo_questions/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/geo_questions", { method: "POST", body: JSON.stringify(payload) });
      }
      resetGeoQuestionForm();
      $("#geoQuestionForm").style.display = "none";
      toast("GEO 问题已保存", "success");
      await load();
    } catch (e) {
      toast("保存失败：" + e.message, "error");
    } finally {
      if (btn) setLoading(btn, false);
    }
  });
  $("#resetGeoQuestionBtn").addEventListener("click", () => {
    $("#geoQuestionForm").style.display = "none";
    resetGeoQuestionForm();
  });
  $("#geoSearch").addEventListener("input", debounce(renderGeoQuestions, 200));

  $("#buildGeoPromptBtn").addEventListener("click", async () => {
    const productId = ($("#pdId").value) || "";
    if (!productId) return toast("请先保存产品", "error");
    const product = state.products.find(p => p.id === productId);
    if (!product) return toast("未找到产品", "error");
    const count = Number($("#geoPromptCount").value || 12);
    const prompt = buildGeoQuestionPrompt(product, count);
    $("#geoPromptBox").value = prompt;
    toast("GEO 问题 Prompt 已生成", "success");
  });

  $("#copyGeoPromptBtn").addEventListener("click", async () => {
    await copyToClipboard($("#geoPromptBox").value);
    toast("GEO 问题 Prompt 已复制", "success");
  });

  $("#importGeoQuestionsBtn").addEventListener("click", async () => {
    const productId = ($("#pdId").value) || "";
    if (!productId) return toast("请先保存产品", "error");
    const raw = $("#geoImportBox").value;
    if (!raw.trim()) return toast("请先粘贴 AI 返回的 JSON", "error");
    let parsed, imported = 0, skipped = 0, failed = 0;
    try {
      parsed = extractJsonArray(raw).filter(i => i && typeof i === "object");
    } catch (err) {
      return toast("JSON 格式错误：" + err.message, "error");
    }
    for (const item of parsed) {
      const question = (item.question || item["问题"] || "").trim();
      if (!question) { skipped++; continue; }
      try {
        await api("/api/geo_questions", {
          method: "POST",
          body: JSON.stringify({
            product_id: productId,
            question,
            intent: item.intent || item["意图"] || "",
            audience: item.audience || item["人群"] || "",
            priority: item.priority || item["优先级"] || "medium",
            status: "active",
            content_angle: item.content_angle || item["内容角度"] || "",
            target_platform: item.target_platform || item["目标平台"] || "",
          }),
        });
        imported++;
      } catch (e) {
        failed++;
        console.warn("GEO 问题导入失败：", question, e.message);
      }
    }
    $("#geoImportBox").value = "";
    await load();
    toast(`导入完成：成功 ${imported} 条，失败 ${failed} 条${skipped ? `，${skipped} 条跳过` : ""}`, failed ? "default" : "success");
  });

  // --- 文章导入 ---
  $("#importArticlesBtn")?.addEventListener("click", async () => {
    const productId = ($("#importArticleProduct")?.value) || "";
    if (!productId) return toast("请选择关联产品", "error");
    const raw = ($("#articleImportBox")?.value || "").trim();
    if (!raw) return toast("请先粘贴 AI 返回的 JSON", "error");
    const geoQuestionId = ($("#importArticleGeoQuestion")?.value) || "0";
    let parsed, imported = 0, skipped = 0;
    try {
      parsed = extractJsonArray(raw).filter(i => i && typeof i === "object");
    } catch (err) {
      return toast("JSON 格式错误：" + err.message, "error");
    }
    for (const item of parsed) {
      const title = (item.title || item["标题"] || "").trim();
      if (!title) { skipped++; continue; }
      const payload = {
        product_id: productId,
        title,
        body: item.body || item["正文"] || "",
        summary: item.summary || item["摘要"] || "",
        content_type: item.content_type || item["类型"] || "",
        target_platform: item.target_platform || item["目标平台"] || "",
        keywords: item.keywords || item["关键词"] || "",
        tags: item.tags || item["标签"] || "",
        image_prompt: item.image_prompt || item["配图建议"] || "",
        risk_notes: item.risk_notes || item["风险提示"] || "",
        geo_question_id: String(item.geo_question_id || item["geo_question_id"] || geoQuestionId || "0"),
        status: "draft",
      };
      try {
        await api("/api/articles", { method: "POST", body: JSON.stringify(payload) });
        imported++;
      } catch (e) {
        skipped++;
        console.warn("文章导入失败：", title, e.message);
      }
    }
    $("#articleImportBox").value = "";
    toast(`已导入 ${imported} 篇文章${skipped ? "，" + skipped + " 条跳过" : ""}`, "success");
    await load();
  });

  // --- 文章导入产品选择联动 ---
  $("#importArticleProduct")?.addEventListener("change", () => {
    const agEl = $("#importArticleGeoQuestion");
    if (!agEl) return;
    const productId = $("#importArticleProduct").value || "";
    const qs = state.geo_questions.filter(q => !productId || String(q.product_id) === productId);
    agEl.innerHTML = `<option value="">未关联</option>` +
      qs.map(q => `<option value="${q.id}">${escapeHtml(q.question)}</option>`).join("");
  });

  $("#saveAiBtn").addEventListener("click", async () => {
    const btn = $("#saveAiBtn");
    if (isLoading(btn)) return;
    setLoading(btn, true);
    try {
      // 快速开始：填入 Key 即启用 API 直连
      const hasKey = $("#textKey").value || (state.ai_settings && state.ai_settings.has_text_api_key);
      const payload = {
        mode: hasKey ? "api" : ($("#aiMode").value || "manual"),
        text_base_url: $("#textBaseUrl").value || DEFAULT_AI_SETTINGS.text_base_url,
        text_model: $("#textModel").value || DEFAULT_AI_SETTINGS.text_model,
        image_base_url: $("#imageBaseUrl").value || DEFAULT_AI_SETTINGS.image_base_url,
        image_model: $("#imageModel").value || DEFAULT_AI_SETTINGS.image_model,
        temperature: Number($("#aiTemperature").value || 0.7),
      };
      if ($("#textKey").value) payload.text_api_key = $("#textKey").value;
      if ($("#imageKey").value) payload.image_api_key = $("#imageKey").value;
      const recordId = (state.ai_settings && state.ai_settings.id) || null;
      if (recordId) {
        await geoApi(`/api/ai_settings/${recordId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await geoApi("/api/ai_settings", { method: "POST", body: JSON.stringify({ ...payload, mode: payload.mode || "manual" }) });
      }
      $("#textKey").value = "";
      $("#imageKey").value = "";
      toast(payload.mode === "api" ? "AI 已启用 API 直连模式" : "AI 设置已保存（手动模式）", "success");
      await load();
    } catch (e) {
      toast("保存失败：" + e.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

  // 一键切换到手动模式（不调用 API）
  $("#useManualBtn")?.addEventListener("click", () => {
    $("#aiMode").value = "manual";
    toast("已切换到手动 Prompt 模式，点击「保存」生效", "info");
  });

  // 数据导出
  $("#exportProductsBtn")?.addEventListener("click", () => exportCSV("products", state.products, [
    { key: "name", label: "产品名称" }, { key: "type", label: "类型" }, { key: "status", label: "状态" },
    { key: "url", label: "链接" }, { key: "audience", label: "目标用户" }, { key: "selling_points", label: "核心卖点" },
    { key: "competitors", label: "竞品" }, { key: "created_at", label: "创建时间" },
  ]));
  $("#exportArticlesBtn")?.addEventListener("click", () => exportCSV("articles", state.articles, [
    { key: "title", label: "标题" }, { key: "content_type", label: "类型" }, { key: "target_platform", label: "目标平台" },
    { key: "status", label: "状态" }, { key: "summary", label: "摘要" }, { key: "keywords", label: "关键词" },
    { key: "created_at", label: "创建时间" },
  ]));
  $("#exportTasksBtn")?.addEventListener("click", () => exportCSV("tasks", state.tasks, [
    { key: "article_title", label: "文章标题" }, { key: "platform_name", label: "平台" },
    { key: "status", label: "状态" }, { key: "published_url", label: "发布链接" },
    { key: "created_at", label: "创建时间" },
  ]));
  $("#exportAllBtn")?.addEventListener("click", exportAllJSON);

  $("#aiPreset").addEventListener("change", () => {
    const val = $("#aiPreset").value;
    if (val.startsWith("custom_")) {
      applyUserModelToSettings(Number(val.replace("custom_", "")));
      return;
    }
    const preset = aiPresets[Number(val)];
    if (!preset) return;
    $("#aiMode").value = "api";
    $("#textBaseUrl").value = preset.text_base_url || "";
    $("#textModel").value = preset.text_model || "";
    $("#imageBaseUrl").value = preset.image_base_url || "";
    $("#imageModel").value = preset.image_model || "";
    toast(`已切换到「${preset.name}」预设，填入 API Key 后保存`, "info");
  });

  // AI 生成 GEO 问题内容角度
  $("#geoAiAnswerBtn")?.addEventListener("click", async () => {
    const question = $("#geoQuestionText").value.trim();
    if (!question) return toast("请先填写问题", "error");
    const ai = state.ai_settings || {};
    if ((ai.mode || "manual") !== "api") return toast("请在设置中配置 API Key 后使用 AI 生成", "error");
    const btn = $("#geoAiAnswerBtn");
    if (isLoading(btn)) return;
    setLoading(btn, true);
    try {
      const productId = $("#geoProduct").value || selectedProductId;
      const product = state.products.find(p => p.id === productId);
      const sys = `你是 GEO（生成式引擎优化）专家。针对用户提出的问题，给出一个 80-150 字的「内容角度」建议：如何在回答中自然带出产品。直接输出建议文本，不要前缀。`;
      const user = `问题：${question}\n产品名称：${product?.name || ""}\n产品卖点：${product?.selling_points || ""}\n品牌语气：${product?.tone || ""}`;
      const messages = [
        { role: "system", content: sys },
        { role: "user", content: user },
      ];
      const result = await callAI(ai, messages);
      $("#geoAngle").value = result;
      toast("AI 已生成内容角度", "success");
    } catch (e) {
      toast("AI 生成失败：" + e.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

  // --- Workshop (AI 生成配置，写入文章编辑器) ---
  $("#workshopDirectBtn")?.addEventListener("click", async () => {
    const btn = $("#workshopDirectBtn");
    if (isLoading(btn)) return;
    const productId = ($("#workshopProduct")?.value) || "";
    if (!productId) return toast("请选择产品", "error");
    const product = state.products.find(p => p.id === productId);
    if (!product) return toast("未找到产品", "error");

    const types = selectedValues("#workshop .workshop-types");
    const platformNames = selectedValues("#workshop .workshop-platforms");
    const notes = ($("#workshopNote")?.value || "").trim();

    if (!types.length && !platformNames.length) return toast("请至少选择一个内容类型或平台", "error");

    const aiSettings = state.ai_settings || {};
    if (!aiSettings.text_api_key) return toast("请先配置 AI Key", "error");

    // 获取该产品的 GEO 问题，使用更丰富的 prompt
    const geoQuestions = state.geo_questions.filter(q => String(q.product_id) === productId && q.status === "active");
    const platformObjs = state.platforms.filter(p => platformNames.includes(p.name));

    let prompt;
    if (geoQuestions.length > 0 && platformObjs.length > 0) {
      // 使用带 GEO 问题上下文的富 prompt
      prompt = buildProductPrompt(product, platformObjs, 1, types, geoQuestions);
    } else {
      // 回退到简单 prompt
      prompt = buildWorkshopPrompt(product, types, platformNames, notes);
    }

    setLoading(btn);
    toast("正在生成内容...");
    try {
      const raw = await callAI(aiSettings, [
        { role: "system", content: "你是一个专业的中文内容创作者，输出 Markdown 格式文本。" },
        { role: "user", content: prompt },
      ]);
      applyWorkshopResult(raw, productId, types, platformNames);
      toast("内容已生成，请检查后保存", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

  $("#workshopPromptBtn")?.addEventListener("click", async () => {
    const productId = ($("#workshopProduct")?.value) || "";
    if (!productId) return toast("请选择产品", "error");
    const product = state.products.find(p => p.id === productId);
    if (!product) return toast("未找到产品", "error");

    const types = selectedValues("#workshop .workshop-types");
    const platformNames = selectedValues("#workshop .workshop-platforms");
    const notes = ($("#workshopNote")?.value || "").trim();

    // 获取该产品的 GEO 问题，使用更丰富的 prompt
    const geoQuestions = state.geo_questions.filter(q => String(q.product_id) === productId && q.status === "active");
    const platformObjs = state.platforms.filter(p => platformNames.includes(p.name));

    let prompt;
    if (geoQuestions.length > 0 && platformObjs.length > 0) {
      prompt = buildProductPrompt(product, platformObjs, 1, types, geoQuestions);
    } else {
      prompt = buildWorkshopPrompt(product, types, platformNames, notes);
    }

    applyWorkshopResult(prompt, productId, types, platformNames);
    await copyToClipboard(prompt);
    toast("Prompt 已生成、填入编辑器并复制", "success");
  });

  $("#workshopRewriteBtn")?.addEventListener("click", () => workshopAiEdit("改写"));
  $("#workshopExpandBtn")?.addEventListener("click", () => workshopAiEdit("扩写"));

  // 平台适配改写
  $("#workshopAdaptBtn")?.addEventListener("click", async () => {
    const btn = $("#workshopAdaptBtn");
    if (isLoading(btn)) return;
    const body = ($("#articleBody")?.value || "").trim();
    if (!body) return toast("内容为空，请先填写或生成文章", "error");

    const aiSettings = state.ai_settings || {};
    if (!aiSettings.text_api_key) return toast("请先配置 AI Key", "error");

    // 弹出平台选择模态框
    const platformOptions = state.platforms.filter(p => p.status === "enabled");
    if (!platformOptions.length) return toast("没有可用的平台", "error");

    showPlatformSelectModal(platformOptions, async (platform) => {
      // 获取关联产品
      const articleProductId = $("#articleProduct")?.value || "";
      const workshopProductId = $("#workshopProduct")?.value || "";
      const pid = articleProductId || workshopProductId;
      const product = pid ? state.products.find(p => p.id === pid) : null;

      // 构建当前文章对象
      const article = {
        title: $("#articleTitle")?.value || "",
        summary: $("#articleSummary")?.value || "",
        body: body,
        content_type: $("#articleType")?.value || "",
        target_platform: $("#articlePlatform")?.value || "",
        keywords: $("#articleKeywords")?.value || "",
        tags: $("#articleTags")?.value || "",
        image_prompt: $("#articleImage")?.value || "",
        risk_notes: $("#articleRisk")?.value || "",
      };

      const prompt = buildAdaptationPrompt(article, platform, product);

      setLoading(btn);
      toast(`正在适配「${platform.name}」...`);
      try {
        const raw = await callAI(aiSettings, [
          { role: "system", content: "你是一个专业的中文内容创作者，熟悉各平台内容规范。输出 JSON 对象。" },
          { role: "user", content: prompt },
        ]);
        const result = extractJsonObject(raw);
        // 将适配结果填入编辑器
        if (result.title) $("#articleTitle").value = result.title;
        if (result.body) $("#articleBody").value = result.body;
        if (result.summary) $("#articleSummary").value = result.summary;
        if (result.content_type) $("#articleType").value = result.content_type;
        if (result.target_platform) $("#articlePlatform").value = result.target_platform;
        if (result.keywords) $("#articleKeywords").value = result.keywords;
        if (result.tags) $("#articleTags").value = result.tags;
        if (result.image_prompt) $("#articleImage").value = result.image_prompt;
        if (result.risk_notes) $("#articleRisk").value = result.risk_notes;
        renderPreview();
        toast(`已适配「${platform.name}」版本，请检查后保存`, "success");
      } catch (err) {
        toast("适配失败：" + err.message, "error");
      } finally {
        setLoading(btn, false);
      }
    });
  });

  // 一鱼多吃：把当前文章改写为多平台版本
  $("#workshopRepurposeBtn")?.addEventListener("click", async () => {
    const article = {
      title: $("#articleTitle")?.value || "",
      summary: $("#articleSummary")?.value || "",
      body: $("#articleBody")?.value || "",
      content_type: $("#articleType")?.value || "",
      keywords: $("#articleKeywords")?.value || "",
      tags: $("#articleTags")?.value || "",
      product_id: $("#articleProduct")?.value || "",
    };
    if (!article.title || !article.body) return toast("请先填写文章标题和正文", "error");
    const ai = state.ai_settings || {};
    if ((ai.mode || "manual") !== "api") return toast("请在设置中配置 API Key 后使用", "error");
    const platforms = (state.platforms || []).filter(p => p.status === "enabled");
    if (platforms.length === 0) return toast("请先在「发布平台」中添加启用平台", "error");
    const product = state.products.find(p => p.id === article.product_id);
    const btn = $("#workshopRepurposeBtn");
    if (isLoading(btn)) return;
    setLoading(btn, true);
    try {
      const prompt = buildContentRepurposePrompt(article, platforms, product);
      const messages = [
        { role: "system", content: "你是多平台内容分发专家，擅长把一篇文章改写为符合不同平台风格的版本。" },
        { role: "user", content: prompt },
      ];
      const raw = await callAI({ ...ai, temperature: 0.7 }, messages);
      const arr = extractJsonArray(raw).filter(i => i && typeof i === "object");
      if (arr.length === 0) return toast("AI 未返回有效结果", "error");
      // 批量创建文章
      let created = 0;
      for (const item of arr) {
        try {
          await api("/api/articles", {
            method: "POST",
            body: JSON.stringify({
              product_id: article.product_id,
              title: item.title || "未命名",
              summary: item.summary || "",
              body: item.body || "",
              content_type: item.content_type || "软文",
              target_platform: item.target_platform || "",
              keywords: item.keywords || "",
              tags: item.tags || "",
              image_prompt: item.image_prompt || "",
              risk_notes: item.risk_notes || "",
              status: "draft",
            }),
          });
          created++;
        } catch (e) { console.warn("创建失败:", e.message); }
      }
      toast(`一鱼多吃完成：已生成 ${created} 篇文章草稿`, "success");
      await load();
    } catch (e) {
      toast("一鱼多吃失败：" + e.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

  // SEO 优化建议
  $("#workshopSeoBtn")?.addEventListener("click", async () => {
    const article = {
      title: $("#articleTitle")?.value || "",
      summary: $("#articleSummary")?.value || "",
      body: $("#articleBody")?.value || "",
      keywords: $("#articleKeywords")?.value || "",
    };
    if (!article.body) return toast("请先填写文章正文", "error");
    const ai = state.ai_settings || {};
    if ((ai.mode || "manual") !== "api") return toast("请在设置中配置 API Key 后使用", "error");
    const btn = $("#workshopSeoBtn");
    if (isLoading(btn)) return;
    setLoading(btn, true);
    try {
      const keywords = (article.keywords || "").split(/[,，]/).map(s => s.trim()).filter(Boolean);
      const prompt = buildSeoOptimizePrompt(article, keywords);
      const messages = [
        { role: "system", content: "你是 SEO 优化专家，请客观分析文章并给出可执行的优化建议。" },
        { role: "user", content: prompt },
      ];
      const raw = await callAI({ ...ai, temperature: 0.4 }, messages);
      let result;
      try { result = JSON.parse(raw); } catch (_) {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) { try { result = JSON.parse(m[0]); } catch (_e) { /* fall through */ } }
      }
      if (!result) {
        toast("AI 返回结果无法解析，请查看控制台", "warning");
        console.log("SEO 原始返回:", raw);
        return;
      }
      const score = result.score || 0;
      const suggestions = result.suggestions || [];
      const level = score >= 80 ? "good" : score >= 60 ? "medium" : "low";
      const summary = result.summary || `SEO 评分：${score}/100`;
      let msg = `📊 SEO 评分：${score}/100（${level === "good" ? "优秀" : level === "medium" ? "中等" : "待优化"}）\n\n${summary}\n\n`;
      if (suggestions.length) {
        msg += "📝 优化建议：\n";
        suggestions.forEach((s, i) => {
          msg += `${i + 1}. [${s.type || "general"}] ${s.issue}\n   → ${s.fix}\n`;
        });
      }
      if (result.optimized_title) msg += `\n✨ 优化后标题：${result.optimized_title}`;
      if (result.extra_keywords && result.extra_keywords.length) {
        msg += `\n🏷️ 建议新增关键词：${result.extra_keywords.join("、")}`;
      }
      const dlg = document.createElement("div");
      dlg.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000";
      const box = document.createElement("div");
      box.style.cssText = "background:#fff;border-radius:12px;padding:24px;max-width:560px;width:90%;max-height:80vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)";
      box.innerHTML = `<h3 style="margin:0 0 12px">SEO 优化分析</h3><pre style="white-space:pre-wrap;font-size:13px;line-height:1.6;color:#334155">${escapeHtml(msg)}</pre><button style="margin-top:16px;padding:8px 16px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer" onclick="this.parentElement.parentElement.remove()" type="button">关闭</button>`;
      dlg.appendChild(box);
      dlg.addEventListener("click", e => { if (e.target === dlg) dlg.remove(); });
      document.body.appendChild(dlg);
    } catch (e) {
      toast("SEO 分析失败：" + e.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

  // Workshop 子菜单切换（已统一为 sub-tab）
  $$(".sub-tab[data-tab='generated'], .sub-tab[data-tab='generate']").forEach(tab =>
    tab.addEventListener("click", () => switchSubTab(tab.dataset.tab))
  );

  // --- Articles ---
  $("#newArticleBtn").addEventListener("click", () => {
    state.selectedArticleId = null;
    clearArticleDraft();
    ["articleId", "articleTitle", "articleSummary", "articleBody", "articleType", "articlePlatform", "articleKeywords", "articleTags", "articleImage", "articleRisk"].forEach(id => $(`#${id}`).value = "");
    $("#articleProduct").value = "0";
    $("#articleGeoQuestion").value = "0";
    $("#articleStatus").value = "draft";
    setArticleEditorMode(false);
    updateWordCount();
    renderPreview();
    renderArticles();
  });

  // 取消编辑
  $("#cancelArticleBtn")?.addEventListener("click", () => {
    if (!state.selectedArticleId) return;
    state.selectedArticleId = null;
    clearArticleDraft();
    ["articleId", "articleTitle", "articleSummary", "articleBody", "articleType", "articlePlatform", "articleKeywords", "articleTags", "articleImage", "articleRisk"].forEach(id => $(`#${id}`).value = "");
    $("#articleProduct").value = "0";
    $("#articleGeoQuestion").value = "0";
    $("#articleStatus").value = "draft";
    setArticleEditorMode(false);
    updateWordCount();
    renderPreview();
    renderArticles();
  });

  // Markdown 工具栏（文章编辑器）
  $$(".md-btn").forEach(btn => btn.addEventListener("click", () => {
    const textarea = $("#articleBody");
    const md = btn.dataset.md;
    const wrap = btn.dataset.wrap === "true";
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.slice(start, end);
    if (wrap) {
      textarea.value = text.slice(0, start) + md + selected + md + text.slice(end);
      textarea.selectionStart = start + md.length;
      textarea.selectionEnd = end + md.length;
    } else {
      textarea.value = text.slice(0, start) + md + selected + text.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + md.length;
    }
    textarea.focus();
    renderPreview();
  }));

  $("#saveArticleBtn").addEventListener("click", async () => {
    const btn = $("#saveArticleBtn");
    if (isLoading(btn)) return;
    setLoading(btn, true);
    try {
      const id = $("#articleId").value;
      const oldStatus = id ? (state.articles.find(a => a.id === id)?.status || "draft") : "draft";
      const payload = {
        product_id: $("#articleProduct").value || "",
        geo_question_id: $("#articleGeoQuestion").value || "",
        title: $("#articleTitle").value,
        summary: $("#articleSummary").value,
        body: $("#articleBody").value,
        content_type: $("#articleType").value,
        target_platform: $("#articlePlatform").value,
        keywords: $("#articleKeywords").value,
        tags: $("#articleTags").value,
        image_prompt: $("#articleImage").value,
        risk_notes: $("#articleRisk").value,
        status: $("#articleStatus").value,
      };
      const errors = validateArticle(payload);
      if (errors.length) {
        toast(errors.join("；"), "error");
        return;
      }

      let articleId = id;
      if (id) {
        await api(`/api/articles/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        const article = await api("/api/articles", { method: "POST", body: JSON.stringify(payload) });
        articleId = article.id;
        state.selectedArticleId = articleId;
        // 把新分配的 id 写回表单，避免重复创建
        $("#articleId").value = articleId;
      }

      // 工作流自动化：文章状态变为 "approved" 时，自动创建发布任务
      if (payload.status === "approved" && oldStatus !== "approved" && articleId) {
        await autoCreatePublishTasks(articleId, payload.product_id, payload.target_platform);
      }

      clearArticleDraft();
      toast("文章已保存", "success");
      setArticleEditorMode(true);
      await load();
    } catch (e) {
      toast("保存失败：" + e.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

  $("#copyArticleBtn").addEventListener("click", async () => {
    const title = $("#articleTitle").value;
    const body = $("#articleBody").value;
    const tags = $("#articleTags").value;
    await copyToClipboard(`# ${title}\n\n${body}\n\n标签：${tags}`);
    toast("文章内容已复制", "success");
  });

  $("#exportArticleBtn").addEventListener("click", () => {
    const title = $("#articleTitle").value || "untitled";
    const body = [
      `# ${title}`,
      "",
      $("#articleSummary").value ? `> ${$("#articleSummary").value}` : "",
      "",
      $("#articleBody").value,
      "",
      $("#articleTags").value ? `标签：${$("#articleTags").value}` : "",
      $("#articleRisk").value ? `风险提示：${$("#articleRisk").value}` : "",
    ].filter(Boolean).join("\n");
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[\\/:*?"<>|]/g, "_")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  });

  $("#copyImagePromptBtn").addEventListener("click", async () => {
    await copyToClipboard($("#articleImage").value || "");
    toast("配图提示词已复制", "success");
  });

  $("#generateImageBtn").addEventListener("click", async () => {
    const btn = $("#generateImageBtn");
    if (isLoading(btn)) return;
    let prompt = ($("#articleImage").value || "").trim();
    const articleId = ($("#articleId").value);
    if (!prompt && articleId) {
      const article = state.articles.find(a => a.id === articleId);
      prompt = article ? ((article.image_prompt || "") || (article.title || "") + "。" + (article.summary || "")) : "";
    }
    if (!prompt) return toast("请先填写配图建议或选择文章", "error");
    if (!state.ai_settings?.image_model) return toast("请先在「AI 设置」中配置图片生成模型", "error");
    if (!(state.ai_settings?.image_api_key || state.ai_settings?.api_key)) return toast("请先配置图片 API Key", "error");
    setLoading(btn);
    toast("正在生成配图，可能需要几十秒...");
    try {
      const result = await callImageGeneration(prompt, articleId);
      renderGeneratedImage(result, state.ai_settings.image_base_url || "");
      toast("配图已生成", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

  $("#deleteArticleBtn")?.addEventListener("click", async () => {
    const id = ($("#articleId").value);
    if (!id) return toast("请先选择文章", "error");
    if (!confirm("确定删除该文章？")) return;
    try {
      await api(`/api/articles/${id}`, { method: "DELETE" });
      clearArticleDraft();
      state.selectedArticleId = null;
      ["articleId", "articleTitle", "articleSummary", "articleBody", "articleType", "articlePlatform", "articleKeywords", "articleTags", "articleImage", "articleRisk"].forEach(id => $(`#${id}`).value = "");
      $("#articleProduct").value = "0";
      $("#articleGeoQuestion").value = "0";
      $("#articleStatus").value = "draft";
      setArticleEditorMode(false);
      toast("文章已删除", "success");
      await load();
    } catch (e) {
      toast("删除失败：" + e.message, "error");
    }
  });

  $("#articleBody")?.addEventListener("input", debounce(renderPreview, 300));
  $("#articleTitle")?.addEventListener("input", debounce(updateWordCount, 300));
  // 文章编辑器自动保存
  const articleDraftFields = ["articleTitle", "articleSummary", "articleBody", "articleType", "articlePlatform", "articleKeywords", "articleTags", "articleImage", "articleRisk", "articleStatus"];
  const autoSaveDraft = debounce(saveArticleDraft, 1000);
  articleDraftFields.forEach(id => {
    $(`#${id}`)?.addEventListener("input", autoSaveDraft);
    $(`#${id}`)?.addEventListener("change", autoSaveDraft);
  });
  $("#articleProduct")?.addEventListener("change", () => {
    autoSaveDraft();
    // 切换关联产品时，重新加载该产品下的 GEO 问题选项
    const agEl = $("#articleGeoQuestion");
    if (!agEl) return;
    const productId = $("#articleProduct").value || "";
    const qs = state.geo_questions.filter(q => !productId || String(q.product_id) === productId);
    const cur = agEl.value;
    agEl.innerHTML = `<option value="0">未关联（不影响覆盖率统计）</option>` +
      qs.map(q => `<option value="${q.id}">${escapeHtml(q.question)}</option>`).join("");
    // 选项被清空就回退到 0
    agEl.value = qs.some(q => String(q.id) === cur) ? cur : "0";
  });

  // --- Platforms ---
  $("#platformSearch").addEventListener("input", debounce(renderPlatforms, 200));
  $("#taskSearch").addEventListener("input", debounce(renderTasks, 200));

  // 发布记录子菜单切换 + 看板统计筛选
  $$(".sub-tab[data-tab='task-calendar'], .sub-tab[data-tab='task-board'], .sub-tab[data-tab='task-publish']").forEach(tab =>
    tab.addEventListener("click", () => switchSubTab(tab.dataset.tab))
  );
  $("#taskStatProduct")?.addEventListener("change", () => { renderTaskBoardStats(); renderTaskBoard(); });
  $("#taskStatPlatform")?.addEventListener("change", () => { renderTaskBoardStats(); renderTaskBoard(); });

  $("#articleSearch")?.addEventListener("input", debounce(renderArticles, 200));
  $("#articleFilterProduct")?.addEventListener("change", renderArticles);
  $("#articleFilterStatus")?.addEventListener("change", renderArticles);

  // 平台：新增 / 取消 / 编辑 / 删除 / 切换状态
  $("#addPlatformBtn")?.addEventListener("click", () => {
    state.selectedPlatformId = null;
    showPlatformEditMode({ id: "", name: "", category: "", url: "", account_name: "", login_notes: "", content_style: "", recommended_words: "", frequency: "", title_style: "", tags_rule: "", allows_external_links: "limited", soft_article_fit: "medium", status: "enabled", notes: "" });
  });
  $("#cancelPlatformBtn")?.addEventListener("click", () => {
    if (state.selectedPlatformId) {
      const platform = state.platforms.find(p => p.id === state.selectedPlatformId);
      if (platform) renderPlatformDetail(platform);
      else showPlatformViewMode();
    } else {
      resetPlatformForm();
    }
  });
  $("#platformDetailEdit")?.addEventListener("click", () => {
    const platform = state.platforms.find(p => p.id === state.selectedPlatformId);
    if (platform) showPlatformEditMode(platform);
  });

  $("#platformForm").addEventListener("submit", async event => {
    event.preventDefault();
    const btn = event.submitter || event.target.querySelector('button[type="submit"]');
    if (btn && isLoading(btn)) return;
    if (btn) setLoading(btn, true);
    try {
      const id = $("#platformId").value;
      const payload = {
        name: $("#platformName").value,
        category: $("#platformCategory").value,
        url: $("#platformUrl").value,
        account_name: $("#platformAccountName").value,
        login_notes: $("#platformLoginNotes").value,
        content_style: $("#platformContentStyle").value,
        recommended_words: $("#platformWords").value,
        frequency: $("#platformFrequency").value,
        title_style: $("#platformTitleStyle").value,
        tags_rule: $("#platformTagsRule").value,
        allows_external_links: $("#platformLinks").value,
        soft_article_fit: $("#platformFit").value,
        status: $("#platformStatus").value,
        notes: $("#platformNotes").value,
      };
      let savedId = id;
      if (id) {
        await api(`/api/platforms/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        const created = await api("/api/platforms", { method: "POST", body: JSON.stringify(payload) });
        savedId = created.id;
      }
      toast("平台已保存", "success");
      await load();
      if (savedId) selectPlatform(savedId);
    } catch (e) {
      toast("保存失败：" + e.message, "error");
    } finally {
      if (btn) setLoading(btn, false);
    }
  });

  // --- Global Search ---
  bindGlobalSearchEvents();

  // --- Tasks ---
  $("#assignTasksBtn").addEventListener("click", async () => {
    const article_ids = selectedValues("#taskArticlePicker");
    const platform_ids = selectedValues("#taskPlatformPicker");
    if (!article_ids.length || !platform_ids.length) return toast("请选择文章和平台", "error");
    try {
      const data = await api("/api/tasks/assign", { method: "POST", body: JSON.stringify({ article_ids, platform_ids }) });
      const msg = data.skipped.length > 0
        ? `新增 ${data.created.length} 个任务（跳过 ${data.skipped.length} 个已存在）`
        : `新增 ${data.created.length} 个发布任务`;
      toast(msg, "success");
      await load();
    } catch (e) {
      toast("分配失败：" + e.message, "error");
    }
  });

  // 新建发布记录表单
  $("#taskFormProduct")?.addEventListener("change", () => {
    // 产品变化时，重置内容选择并按产品过滤
    const aEl = $("#taskFormArticle");
    if (aEl) aEl.value = "";
    renderTaskForm();
  });
  $("#taskFormPlatform")?.addEventListener("change", () => {
    // 自动填充发布链接为平台 URL（仅当链接为空时）
    const urlEl = $("#taskFormUrl");
    if (urlEl && !urlEl.value.trim()) {
      const pid = $("#taskFormPlatform").value;
      const p = state.platforms.find(x => String(x.id) === String(pid));
      if (p?.url) urlEl.value = p.url;
    }
  });
  $("#openTaskPlatformBtn")?.addEventListener("click", () => {
    const pid = $("#taskFormPlatform").value;
    const p = state.platforms.find(x => String(x.id) === String(pid));
    if (p?.url) window.open(p.url, "_blank", "noopener,noreferrer");
    else toast("请先选择平台", "error");
  });
  $("#resetTaskBtn")?.addEventListener("click", () => {
    ["taskFormProduct", "taskFormArticle", "taskFormPlatform", "taskFormUrl", "taskFormNotes"].forEach(id => $(`#${id}`).value = "");
    $("#taskFormStatus").value = "todo";
    renderTaskForm();
  });
  $("#saveTaskBtn")?.addEventListener("click", async () => {
    const btn = $("#saveTaskBtn");
    if (isLoading(btn)) return;
    const articleId = $("#taskFormArticle").value;
    const platformId = $("#taskFormPlatform").value;
    if (!articleId) return toast("请选择发布内容", "error");
    if (!platformId) return toast("请选择发布平台", "error");
    const status = $("#taskFormStatus").value;
    const payload = {
      article_id: String(articleId),
      platform_id: String(platformId),
      status,
      published_url: $("#taskFormUrl").value.trim(),
      notes: $("#taskFormNotes").value.trim(),
    };
    if (status === "published") payload.published_at = formatLocalNow();
    setLoading(btn, true);
    try {
      await api("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
      toast("发布记录已保存", "success");
      ["taskFormProduct", "taskFormArticle", "taskFormPlatform", "taskFormUrl", "taskFormNotes"].forEach(id => $(`#${id}`).value = "");
      $("#taskFormStatus").value = "todo";
      await load();
    } catch (e) {
      toast("保存失败：" + e.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

  // --- Global Search ---
let globalSearchIndex = -1;
let globalSearchResults = [];

function buildGlobalSearchIndex() {
  // 生成缓存key
  const cacheKey = JSON.stringify({
    p: state.products.length,
    q: state.geo_questions.length,
    a: state.articles.length,
    pl: state.platforms.length,
    t: state.tasks.length,
    pi: state.product_images.length,
  });
  
  // 如果缓存有效，直接返回
  if (_searchIndexCache && _searchIndexCacheKey === cacheKey) {
    return _searchIndexCache;
  }
  
  // 重建索引
  const index = [];
  state.products.forEach(item => index.push({
    type: "product", id: item.id, title: item.name,
    meta: [item.type, item.url].filter(Boolean).join(" · "),
    text: `${item.name} ${item.type} ${item.url} ${item.audience} ${item.selling_points} ${item.competitors} ${item.tone} ${item.goal}`.toLowerCase(),
  }));
  state.geo_questions.forEach(item => index.push({
    type: "geo_question", id: item.id, title: item.question,
    meta: [item.product_name, item.intent].filter(Boolean).join(" · "),
    text: `${item.question} ${item.intent} ${item.audience} ${item.content_angle} ${item.target_platform} ${item.product_name}`.toLowerCase(),
  }));
  state.articles.forEach(item => index.push({
    type: "article", id: item.id, title: item.title,
    meta: [item.target_platform, item.content_type].filter(Boolean).join(" · "),
    text: `${item.title} ${item.summary} ${item.body} ${item.content_type} ${item.target_platform} ${item.keywords} ${item.tags}`.toLowerCase(),
  }));
  state.platforms.forEach(item => index.push({
    type: "platform", id: item.id, title: item.name,
    meta: [item.category, item.account_name].filter(Boolean).join(" · "),
    text: `${item.name} ${item.category} ${item.account_name} ${item.content_style} ${item.notes} ${item.login_notes}`.toLowerCase(),
  }));
  state.tasks.forEach(item => index.push({
    type: "task", id: item.id, title: item.article_title,
    meta: [item.platform_name, item.platform_account_name].filter(Boolean).join(" · "),
    text: `${item.article_title} ${item.platform_name} ${item.platform_account_name} ${item.article_tags}`.toLowerCase(),
  }));
  
  // 更新缓存
  _searchIndexCache = index;
  _searchIndexCacheKey = cacheKey;

  return index;
}

// clearSearchIndexCache 已上移至模块顶层作用域（供 state.js 全局调用）

function performGlobalSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const index = buildGlobalSearchIndex();
  return index.filter(item => item.text.includes(q)).slice(0, 20);
}

function renderGlobalSearchResults(results) {
  const container = $("#globalSearchResults");
  if (!container) return;
  globalSearchResults = results;
  globalSearchIndex = -1;
  if (!results.length) {
    container.innerHTML = `<div class="search-result-empty">未找到“${escapeHtml($("#globalSearch").value.trim())}”相关结果</div>`;
    container.style.display = "block";
    return;
  }
  const groups = {};
  const labels = { product: "产品", geo_question: "GEO 问题", article: "文章", platform: "平台", task: "发布任务" };
  results.forEach(item => {
    if (!groups[item.type]) groups[item.type] = [];
    groups[item.type].push(item);
  });
  container.innerHTML = Object.entries(groups).map(([type, items]) => `
    <div class="search-result-group">
      <h4>${labels[type]}</h4>
      ${items.map((item, idx) => `
        <div class="search-result-item" data-type="${item.type}" data-id="${item.id}" data-idx="${idx}">
          <strong>${escapeHtml(item.title)}</strong>
          ${item.meta ? `<small>${escapeHtml(item.meta)}</small>` : ""}
        </div>
      `).join("")}
    </div>
  `).join("");
  container.style.display = "block";
  $$(".search-result-item").forEach(el => el.addEventListener("click", () => {
    const item = globalSearchResults.find(r => String(r.id) === el.dataset.id && r.type === el.dataset.type);
    navigateToSearchResult(item);
  }));
}

function navigateToSearchResult(item) {
  if (!item) return;
  $("#globalSearch").value = "";
  $("#globalSearchResults").style.display = "none";
  if (item.type === "product") { showView("products"); selectProduct(item.id); }
  else if (item.type === "geo_question") {
    const q = state.geo_questions.find(x => x.id === item.id);
    if (q) {
      showView("products");
      selectProduct(q.product_id);
      setTimeout(() => {
        const card = $(`.geo-question-card[data-id="${q.id}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }
  else if (item.type === "article") { showView("workshop"); selectArticle(item.id); }
  else if (item.type === "platform") { showView("platforms"); selectPlatform(item.id); }
  else if (item.type === "task") { showView("tasks"); }
}

function updateSearchActive(delta) {
  const items = $$(".search-result-item");
  if (!items.length) return;
  items.forEach(el => el.classList.remove("active"));
  globalSearchIndex = (globalSearchIndex + delta + items.length) % items.length;
  items[globalSearchIndex].classList.add("active");
  items[globalSearchIndex].scrollIntoView({ block: "nearest" });
}

function bindGlobalSearchEvents() {
  const input = $("#globalSearch");
  const results = $("#globalSearchResults");
  if (!input || !results) return;
  input.addEventListener("input", debounce(() => {
    renderGlobalSearchResults(performGlobalSearch(input.value));
  }, 150));
  input.addEventListener("focus", () => {
    if (input.value.trim()) renderGlobalSearchResults(performGlobalSearch(input.value));
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); updateSearchActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); updateSearchActive(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const active = $(".search-result-item.active");
      if (active) {
        const item = globalSearchResults.find(r => String(r.id) === active.dataset.id && r.type === active.dataset.type);
        navigateToSearchResult(item);
      } else if (globalSearchResults.length) {
        navigateToSearchResult(globalSearchResults[0]);
      }
    }
    else if (e.key === "Escape") { results.style.display = "none"; input.blur(); }
  });
  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : e.target.parentElement;
    if (!target || !target.closest(".global-search")) results.style.display = "none";
  });
}

// --- Event Delegation for Dynamic Content ---
document.addEventListener("click", handleDelegatedClick);

// 键盘可达性：render.js 把可点击的 <div>/<article> 标记为 role="button" tabindex="0"，
// 这里让它们在 Enter / Space 时触发 click（BUTTON/A 已原生支持，跳过避免双触发）。
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  const clickable = target.closest('[role="button"]');
  if (!clickable) return;
  const tag = clickable.tagName;
  if (tag === "BUTTON" || tag === "A") return; // 原生已处理
  e.preventDefault();
  clickable.click();
});

// --- Keyboard Shortcuts ---
// 注意：Ctrl+K / Ctrl+N / Ctrl+D 等快捷键由 enhancements.js 的 initShortcuts 统一处理
}

// --- Event Delegation Handler ---
// Handles clicks on dynamically rendered elements without re-binding

async function handleDelegatedClick(e) {
  const el = e.target instanceof Element ? e.target : e.target.parentElement;
  if (!el) return;
  const btn = el.closest("button");

  // 复制菜单切换（任务卡片）
  if (btn && btn.classList.contains("task-copy-toggle")) {
    e.stopPropagation();
    const menu = btn.nextElementSibling;
    $$(".copy-menu.show").forEach(m => { if (m !== menu) m.classList.remove("show"); });
    menu.classList.toggle("show");
    return;
  }
  // 点击其他区域关闭复制菜单
  if (!btn || !btn.closest(".copy-group")) {
    $$(".copy-menu.show").forEach(m => m.classList.remove("show"));
  }

  // 文章列表行点击（无需 button 触发）
  const articleRow = el.closest(".article-row");
  if (articleRow) {
    selectArticle(articleRow.dataset.id);
    return;
  }

  // Empty-state jump buttons
  const jumpBtn = el.closest("[data-action='jump']");
  if (jumpBtn) {
    showView(jumpBtn.dataset.target);
    return;
  }

  // GEO 问题空状态：展开新增表单
  const toggleGeoBtn = el.closest("[data-action='toggle-geo-form']");
  if (toggleGeoBtn) {
    resetGeoQuestionForm();
    $("#geoQuestionForm").style.display = "";
    $("#geoQuestionText")?.focus();
    return;
  }

  // 仪表盘北极星：跳到产品页并定位 GEO 区做引用检测
  const gotoDetectBtn = el.closest("[data-action='goto-products-detect']");
  if (gotoDetectBtn) {
    showView("products");
    const p = state.products.find(pp => state.geo_questions.some(q => String(q.product_id) === String(pp.id))) || state.products[0];
    if (p) selectProduct(p.id);
    setTimeout(() => {
      const geoSection = document.querySelector(".pd-geo-section");
      if (geoSection) geoSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    return;
  }

  // 平台空状态：进入新增平台模式
  const switchPlatformAddBtn = el.closest("[data-action='switch-platform-add']");
  if (switchPlatformAddBtn) {
    state.selectedPlatformId = null;
    showPlatformEditMode({ id: "", name: "", category: "", url: "", account_name: "", login_notes: "", content_style: "", recommended_words: "", frequency: "", title_style: "", tags_rule: "", allows_external_links: "limited", soft_article_fit: "medium", status: "enabled", notes: "" });
    return;
  }

  // Calendar task click → 切换到看板视图
  const calTask = el.closest(".calendar-task");
  if (calTask && calTask.dataset.id) {
    switchSubTab("task-board");
    return;
  }

  if (!btn) return;

  // Product detail actions
  if (btn.id === "productDetailEdit") {
    e.stopPropagation();
    const product = state.products.find(p => p.id === selectedProductId);
    if (product) showProductEditMode(product);
    return;
  }
  if (btn.id === "productDetailDelete") {
    e.stopPropagation();
    if (!confirm("确定删除该产品？相关数据不会删除。")) return;
    try {
      await api(`/api/products/${selectedProductId}`, { method: "DELETE" });
      toast("产品已删除", "success");
      resetProductForm();
      await load();
    } catch (e) { toast("删除失败：" + e.message, "error"); }
    return;
  }
  if (btn.id === "cancelProductBtn") {
    e.stopPropagation();
    if (selectedProductId) {
      const product = state.products.find(p => p.id === selectedProductId);
      if (product) renderProductDetail(product);
      else showProductViewMode();
    } else {
      resetProductForm();
    }
    return;
  }
  if (btn.id === "addProductBtn") {
    e.stopPropagation();
    selectedProductId = null;
    // 创建新产品时显示编辑模式
    showProductEditMode({ id: "", name: "", type: "", url: "", audience: "", selling_points: "", competitors: "", tone: "真实、专业、克制", goal: "", forbidden_words: "" });
    return;
  }
  if (btn.id === "productGoToDetail") {
    e.stopPropagation();
    if (selectedProductId) showProductDetail(selectedProductId);
    return;
  }
  if (btn.id === "productGoToWorkshop") {
    e.stopPropagation();
    showView("workshop");
    const wp = $("#workshopProduct");
    if (wp) wp.value = selectedProductId;
    return;
  }

  // Product list actions (legacy)
  if (btn.classList.contains("edit-product")) {
    e.stopPropagation();
    selectProduct(btn.dataset.id);
    return;
  }
  if (btn.classList.contains("use-product")) {
    e.stopPropagation();
    showView("workshop");
    const wp = $("#workshopProduct");
    if (wp) wp.value = btn.dataset.id;
    return;
  }
  if (btn.classList.contains("delete-product")) {
    e.stopPropagation();
    if (!confirm("确定删除该产品？相关数据不会删除。")) return;
    try {
      await api(`/api/products/${btn.dataset.id}`, { method: "DELETE" });
      toast("产品已删除", "success");
      resetProductForm();
      await load();
    } catch (e) { toast("删除失败：" + e.message, "error"); }
    return;
  }

  // Product detail open (from product list or stat cards)
  if (btn.classList.contains("open-product-detail")) {
    e.stopPropagation();
    selectProduct(btn.dataset.id);
    return;
  }
  if (btn.classList.contains("open-product-geo")) {
    e.stopPropagation();
    showView("products");
    selectProduct(btn.dataset.id);
    setTimeout(() => {
      const geoSection = document.querySelector(".pd-geo-section");
      if (geoSection) geoSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    return;
  }

  // Matrix action buttons
  if (btn.classList.contains("matrix-generate")) {
    e.stopPropagation();
    const productId = btn.dataset.productId;
    const platform = btn.dataset.platform;
    showView("workshop");
    if (productId) {
      $("#workshopProduct").value = productId;
      $("#workshopProduct").dispatchEvent(new Event("change"));
    }
    if (platform) {
      // 直接遍历比较 .value，避免平台名含 "、[、] 等字符时 CSS 属性选择器失配
      const cb = $$("#workshop .workshop-platforms input[type='checkbox']").find(el => el.value === platform);
      if (cb) cb.checked = true;
    }
    return;
  }

  if (btn.classList.contains("matrix-view-content")) {
    e.stopPropagation();
    const productId = btn.dataset.productId;
    const platform = btn.dataset.platform;
    showView("workshop");
    if (productId) $("#articleFilterProduct").value = productId;
    if (platform) $("#articleSearch").value = platform;
    renderArticles();
    return;
  }

  // GEO question actions
  if (btn.classList.contains("edit-geo-question")) {
    selectGeoQuestion(btn.dataset.id);
    return;
  }
  if (btn.classList.contains("ai-geo-question")) {
    const q = state.geo_questions.find(x => x.id === btn.dataset.id);
    if (!q) return;
    await aiOptimizeGeoQuestion(q);
    return;
  }
  if (btn.classList.contains("rank-check")) {
    if (isLoading(btn)) return;
    await doRankCheck(btn.dataset.id, btn.dataset.product, { btn });
    return;
  }
  if (btn.classList.contains("cover-geo-question")) {
    try {
      await api(`/api/geo_questions/${btn.dataset.id}`, { method: "PUT", body: JSON.stringify({ status: "covered" }) });
      toast("已标记为覆盖", "success");
      await load();
    } catch (e) { toast("操作失败：" + e.message, "error"); }
    return;
  }
  if (btn.classList.contains("delete-geo-question")) {
    if (!confirm("确定删除这个 GEO 问题？")) return;
    try {
      await api(`/api/geo_questions/${btn.dataset.id}`, { method: "DELETE" });
      toast("GEO 问题已删除", "success");
      await load();
    } catch (e) { toast("删除失败：" + e.message, "error"); }
    return;
  }

  // Platform actions（新左右分栏布局：通过按钮 ID 处理；旧卡片视图兼容 class）
  if (btn.id === "platformDetailOpen" || btn.classList.contains("open-platform")) {
    const url = btn.dataset.url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast("该平台未配置发布入口链接", "error");
    return;
  }
  if (btn.id === "platformDetailToggle" || btn.classList.contains("toggle-platform")) {
    const pid = btn.dataset.id || state.selectedPlatformId;
    if (!pid) return;
    try {
      await api(`/api/platforms/${pid}`, { method: "PUT", body: JSON.stringify({ status: btn.dataset.status }) });
      await load();
      // 切换状态后保持选中
      if (state.platforms.find(p => p.id === pid)) selectPlatform(pid);
    } catch (e) { toast("操作失败：" + e.message, "error"); }
    return;
  }
  if (btn.id === "platformDetailDelete" || btn.classList.contains("delete-platform")) {
    const pid = btn.dataset.id || state.selectedPlatformId;
    if (!pid) return;
    if (!confirm("确定删除该平台？")) return;
    try {
      await api(`/api/platforms/${pid}`, { method: "DELETE" });
      toast("平台已删除", "success");
      resetPlatformForm();
      await load();
    } catch (e) { toast("删除失败：" + e.message, "error"); }
    return;
  }
  if (btn.classList.contains("edit-platform")) {
    selectPlatform(btn.dataset.id);
    return;
  }

  // Task actions
  if (btn.classList.contains("task-status")) {
    const id = btn.dataset.id;
    const newStatus = btn.dataset.status;
    const task = state.tasks.find(t => t.id === id);
    const wasPublished = task?.status === "published";
    const body = { status: newStatus };
    const urlInput = $(`#publishedUrl-${id}`);
    if (urlInput) body.published_url = urlInput.value;
    const isNewPublish = newStatus === "published" && !wasPublished;
    if (newStatus === "published" && !body.published_at) body.published_at = formatLocalNow();
    try {
      await api(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(body) });
      if (isNewPublish) {
        toast("🎉 发布成功！内容已记录，别忘了分享哦～", "celebrate");
      } else if (newStatus === "revise") {
        toast("已标记为需修改", "warning");
      } else if (newStatus === "skipped") {
        toast("已跳过该任务", "info");
      } else {
        toast("状态已更新", "success");
      }
      await load();
    } catch (e) { toast("操作失败：" + e.message, "error"); }
    return;
  }
  if (btn.classList.contains("task-open")) {
    const url = btn.dataset.url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast("该平台未配置发布入口链接", "error");
    return;
  }
  if (btn.classList.contains("task-copy")) {
    const task = state.tasks.find(item => item.id === btn.dataset.id);
    if (!task) return;
    const text = taskCopyText(task, btn.dataset.kind);
    await copyToClipboard(text);
    if (btn.dataset.kind === "share") {
      toast("分享链接已复制！快去分享吧 ✨", "celebrate");
    } else {
      toast("发布素材已复制", "success");
    }
    return;
  }
  if (btn.classList.contains("task-share-card")) {
    if (typeof showShareCard === "function") {
      showShareCard(btn.dataset.id);
    }
    return;
  }
  if (btn.classList.contains("task-delete")) {
    if (!confirm("确定删除该任务？")) return;
    try {
      await api(`/api/tasks/${btn.dataset.id}`, { method: "DELETE" });
      toast("任务已删除", "success");
      await load();
    } catch (e) { toast("删除失败：" + e.message, "error"); }
    return;
  }

  // Calendar navigation
  if (btn.dataset.calendar === "prev") {
    state.taskCalendarDate.setMonth(state.taskCalendarDate.getMonth() - 1);
    renderTaskCalendar();
    return;
  }
  if (btn.dataset.calendar === "next") {
    state.taskCalendarDate.setMonth(state.taskCalendarDate.getMonth() + 1);
    renderTaskCalendar();
    return;
  }

  // --- User Model actions ---
  if (btn.classList.contains("edit-user-model")) {
    selectUserModel(btn.dataset.id);
    return;
  }
  if (btn.classList.contains("use-user-model")) {
    applyUserModelToSettings(btn.dataset.id);
    return;
  }
  if (btn.classList.contains("delete-user-model")) {
    if (!confirm("确定删除该自定义模型？")) return;
    try {
      await api(`/api/user_models/${btn.dataset.id}`, { method: "DELETE" });
      toast("模型已删除", "success");
      await load();
    } catch (err) {
      toast("删除失败：" + err.message, "error");
    }
    return;
  }
}

// ===== Product Detail Helpers ============================================

function ensurePdIdInput() {
  let el = $("#pdId");
  if (!el) {
    el = document.createElement("input");
    el.type = "hidden";
    el.id = "pdId";
    const meta = document.querySelector("#productDetail .product-meta");
    if (meta) meta.appendChild(el);
  }
  return el;
}

function showProductDetail(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  ensurePdIdInput().value = product.id;
  $("#pdName").value = product.name || "";
  $("#pdType").value = product.type || "";
  $("#pdUrl").value = product.url || "";
  $("#pdStatus").value = product.status || "active";
  $("#pdMarkdown").value = product.description || product.markdown || "";
  showView("productDetail");
  updateProductMdPreview();
  renderProductImages(id);
  // 切换产品时重置保存状态
  _pdSaving = false;
  setPdSaveStatus("idle");
  // 重置聊天消息
  const chatBox = $("#pdChatMessages");
  if (chatBox) {
    chatBox.innerHTML = "";
    addChatMessage("assistant", `你好！我是 AI 助手，可以帮助你优化「${escapeHtml(product.name || "此产品")}」的介绍。\n\n你可以：
• 请我润色某段文字
• 补充产品亮点
• 优化 Markdown 排版
• 根据目标用户调整语气`);
  }
}

function updateProductMdPreview() {
  const md = ($("#pdMarkdown")?.value || "").trim();
  const preview = $("#pdPreview");
  if (preview) preview.innerHTML = markdownToHtml(md);
}

// 产品详情页保存状态指示
const PD_SAVE_LABELS = {
  idle: "未修改",
  dirty: "有修改…",
  saving: "保存中…",
  saved: "已保存",
  error: "保存失败",
};
let _pdSaving = false; // 防止并发保存
let _pdDirty = false; // 保存进行中又有新编辑时置脏，finally 里补存，避免静默丢编辑
function setPdSaveStatus(state) {
  const el = $("#pdSaveStatus");
  if (!el) return;
  el.dataset.state = state;
  el.textContent = PD_SAVE_LABELS[state] || "";
}
// 统一的产品保存函数：支持全字段保存或仅描述保存
async function saveProductFromForm({ showToast = false, silent = false, onlyDescription = false } = {}) {
  if (_pdSaving) { _pdDirty = true; return; }
  const id = ($("#pdId")?.value) || "";
  const payload = onlyDescription
    ? { description: $("#pdMarkdown")?.value || "" }
    : {
        name: $("#pdName")?.value || "",
        type: $("#pdType")?.value || "",
        url: $("#pdUrl")?.value || "",
        status: $("#pdStatus")?.value || "active",
        description: $("#pdMarkdown")?.value || "",
      };
  if (!id && onlyDescription) return; // 新建未保存时不自动保存
  setPdSaveStatus("saving");
  _pdSaving = true;
  try {
    if (id) {
      await api(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      const created = await api("/api/products", { method: "POST", body: JSON.stringify(payload) });
      if (created && created.id) ensurePdIdInput().value = created.id;
    }
    setPdSaveStatus("saved");
    if (showToast) toast("产品已保存", "success");
    // 2.5s 后回到 idle，给用户留反馈时间
    setTimeout(() => {
      const el = $("#pdSaveStatus");
      if (el && el.dataset.state === "saved") setPdSaveStatus("idle");
    }, 2500);
    // 静默保存时也刷新列表数据，但用低优先级避免抖动
    if (!silent) await load();
  } catch (err) {
    setPdSaveStatus("error");
    if (showToast) toast("保存失败：" + err.message, "error");
    else toast("自动保存失败：" + err.message, "error");
  } finally {
    _pdSaving = false;
    if (_pdDirty) {
      _pdDirty = false;
      // 保存进行期间又产生了新编辑，补存一次（读取最新 DOM 值）
      saveProductFromForm({ silent: true, onlyDescription });
    }
  }
}

// ===== GEO 排名检测（citation check）=====================================
// 单题检测：让 AI 回答该问题，判断是否引用产品，存一条记录
async function doRankCheck(questionId, productId, opts = {}) {
  const product = state.products.find(p => p.id === productId);
  const question = state.geo_questions.find(q => q.id === questionId);
  if (!product || !question) return;
  const settings = state.ai_settings || {};
  if (!(settings.text_api_key || settings.api_key)) {
    toast("请先在「AI 设置」配置 API Key", "error");
    return;
  }
  const btn = opts.btn;
  const silent = opts.silent; // 批量调用时跳过逐题 load/toast，由调用方统一收尾
  if (btn) setLoading(btn, true);
  try {
    const result = await checkGeoRank(settings, product.name, question.question);
    await geoApi("/api/geo_rank_checks", {
      method: "POST",
      body: JSON.stringify({
        user_id: getCurrentUserId(),
        product_id: productId,
        geo_question_id: questionId,
        cited: !!result.cited,
        rank: result.rank || 0,
        snippet: (result.snippet || "").slice(0, 500),
        raw_response: (result.answer || "").slice(0, 4000),
        engine: settings.text_model || settings.model || "",
      }),
    });
    if (!silent) {
      await load();
      toast(result.cited
        ? `✓ AI 引用了「${product.name}」${result.rank ? `（第 ${result.rank} 位）` : ""}`
        : `✗ AI 暂未引用「${product.name}」`, result.cited ? "success" : "default");
    }
    return result;
  } catch (err) {
    if (!silent) toast("检测失败：" + err.message, "error");
    else throw err;
  } finally {
    if (btn) setLoading(btn, false);
  }
}

// 整产品批量检测（串行，避免触发厂商限速）
async function doRankCheckBatch(productId) {
  const qs = state.geo_questions.filter(q => String(q.product_id) === String(productId));
  if (!qs.length) { toast("该产品还没有 GEO 问题", "error"); return; }
  const settings = state.ai_settings || {};
  if (!(settings.text_api_key || settings.api_key)) { toast("请先配置 API Key", "error"); return; }
  // 成本知情同意：批量检测 = N 次 AI 调用，可能消耗较多额度与时间
  if (!confirm(`将对「${state.products.find(p => p.id === productId)?.name || "该产品"}」的 ${qs.length} 个 GEO 问题逐一检测引用情况（约 ${qs.length} 次 AI 调用，可能耗时 ${Math.ceil(qs.length * 6)}秒+）。继续？`)) return;
  const btn = $("#pdGeoCheckAllBtn");
  const original = btn ? btn.textContent : "";
  let done = 0, cited = 0, failed = 0;
  for (const q of qs) {
    if (btn) btn.textContent = `检测中 ${done}/${qs.length}…`;
    try {
      const r = await doRankCheck(q.id, productId, { silent: true });
      if (r && r.cited) cited++;
    } catch (e) { failed++; }
    done++;
  }
  if (btn) btn.textContent = original;
  await load(); // 批量结束后统一刷新一次（而非每题刷新，避免 N 次全量拉取）
  toast(`检测完成：${done} 题，已引用 ${cited}，失败 ${failed}`, cited > 0 ? "success" : "default");
}

// 将 AI 生成的内容填入文章编辑器，并自动补全标题/类型/平台/产品关联
function applyWorkshopResult(raw, productId, types, platforms) {
  const body = String(raw || "").trim();
  const titleEl = $("#articleTitle");
  const bodyEl = $("#articleBody");
  bodyEl.value = body;
  // 自动补全标题（保留用户已填则不覆盖）
  if (!titleEl.value.trim()) {
    const hMatch = body.match(/^#+\s+(.+)$/m);
    if (hMatch) titleEl.value = hMatch[1].trim();
    else {
      const firstLine = body.split("\n")[0].trim();
      if (firstLine) titleEl.value = firstLine.slice(0, 60);
    }
  }
  if (productId) $("#articleProduct").value = String(productId);
  if (types && types.length && !$("#articleType").value.trim()) {
    $("#articleType").value = types.join(",");
  }
  if (platforms && platforms.length && !$("#articlePlatform").value.trim()) {
    $("#articlePlatform").value = platforms.join(",");
  }
  setArticleEditorMode(true);
  renderPreview();
  renderArticles();
  // workshop 已无 sub-tabs，无需切换
  bodyEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

// 通用子菜单切换：仅用于 tasks 页面
// tabName 形如 "task-calendar" / "task-board" / "task-publish"
function switchSubTab(tabName) {
  $$(".sub-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  $$(".sub-tab-panel").forEach(p => {
    p.classList.toggle("active", p.dataset.panel === tabName);
  });
}

// ===== AI 优化 GEO 问题（深度融合 AI） =====

// AI 优化单个 GEO 问题：自动优化问题措辞 + 生成内容角度 + 补全意图/人群
async function aiOptimizeGeoQuestion(q) {
  const ai = state.ai_settings || {};
  if ((ai.mode || "manual") !== "api") return toast("请在「设置」中填入 API Key 后使用 AI 优化", "error");
  const btn = document.querySelector(`.ai-geo-question[data-id="${q.id}"]`);
  if (btn && isLoading(btn)) return;
  if (btn) setLoading(btn, true);
  try {
    const product = state.products.find(p => p.id === q.product_id);
    const sys = `你是 GEO（生成式引擎优化）专家。优化用户的 GEO 问题，使其更贴近真实用户在 AI 助手中的提问方式，并给出内容创作角度。返回 JSON：{"question":"优化后的问题","intent":"意图","audience":"人群","content_angle":"80-120字内容角度建议"}。只输出 JSON，不要解释。`;
    const user = `原始问题：${q.question}\n当前意图：${q.intent || ""}\n当前人群：${q.audience || ""}\n产品名称：${product?.name || ""}\n产品卖点：${product?.selling_points || ""}\n品牌语气：${product?.tone || ""}`;
    const messages = [
      { role: "system", content: sys },
      { role: "user", content: user },
    ];
    const raw = await callAI({ ...ai, temperature: 0.6 }, messages);
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (_e) { /* fall through */ } }
    }
    if (!parsed) {
      // 解析失败，仅更新内容角度
      $("#geoAngle").value = raw.slice(0, 200);
      toast("AI 已生成内容角度（JSON 解析失败，仅填充角度）", "info");
    } else {
      // 加载到表单
      selectGeoQuestion(q.id);
      if (parsed.question) $("#geoQuestionText").value = parsed.question;
      if (parsed.intent) $("#geoIntent").value = parsed.intent;
      if (parsed.audience) $("#geoAudience").value = parsed.audience;
      if (parsed.content_angle) $("#geoAngle").value = parsed.content_angle;
      toast("AI 已优化，可在表单中查看并保存", "success");
    }
  } catch (e) {
    toast("AI 优化失败：" + e.message, "error");
  } finally {
    if (btn) setLoading(btn, false);
  }
}

// ===== AI Chat Helpers ===================================================

function sendPdChatMessage() {
  const input = $("#pdChatInput");
  if (!input) return;
  const userMsg = input.value.trim();
  if (!userMsg) return;

  const productId = ($("#pdId")?.value) || "";
  const product = productId ? state.products.find(p => p.id === productId) : null;
  const mdContent = ($("#pdMarkdown")?.value || "").trim();

  addChatMessage("user", userMsg);
  input.value = "";

  const aiSettings = state.ai_settings || {};
  if (!aiSettings.text_api_key) {
    addChatMessage("assistant", "请先在「设置」中配置 AI Key");
    return;
  }

  const systemPrompt = `你是产品内容助手，根据以下产品信息帮助用户优化产品介绍。

产品信息：
- 名称：${product?.name || "未设置"}
- 类型：${product?.type || ""}
- 链接：${product?.url || ""}
- 目标用户：${product?.audience || ""}
- 核心卖点：${product?.selling_points || ""}
- 品牌语气：${product?.tone || ""}
- 禁用表达：${product?.forbidden_words || ""}

当前产品介绍（Markdown）：
${mdContent || "暂无内容"}

请根据用户的问题，提供优化建议。如果你建议修改 Markdown 内容，请用清晰的格式给出建议。`;

  callAI(aiSettings, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMsg },
  ]).then(response => {
    const hasMarkdown = /```markdown|```md|^#{1,3} |\*\*/.test(response);
    addChatMessage("assistant", response, hasMarkdown);
  }).catch(err => {
    addChatMessage("assistant", `错误：${err.message}`);
  });
}

function addChatMessage(role, text, hasApply = false) {
  const container = $("#pdChatMessages");
  if (!container) return;

  const msgDiv = document.createElement("div");
  msgDiv.className = `ai-chat-msg ${role}`;

  const content = document.createElement("div");
  content.className = "ai-chat-msg-content";
  content.innerHTML = markdownToHtml(text);
  msgDiv.appendChild(content);

  if (role === "assistant" && hasApply) {
    const applyBtn = document.createElement("button");
    applyBtn.className = "btn ghost sm ai-chat-apply-btn";
    applyBtn.textContent = "应用到产品介绍";
    applyBtn.addEventListener("click", () => {
      let mdText = text;
      const mdMatch = text.match(/```(?:markdown|md)?\s*\n([\s\S]*?)```/);
      if (mdMatch) {
        mdText = mdMatch[1].trim();
      }
      $("#pdMarkdown").value = mdText;
      updateProductMdPreview();
      toast("已应用到产品介绍", "success");
    });
    msgDiv.appendChild(applyBtn);
  }

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

// ===== Workshop Helpers ==================================================

// 平台选择模态框
function showPlatformSelectModal(platforms, onSelect) {
  const modal = $("#platformSelectModal");
  const list = $("#platformSelectList");
  const search = $("#platformSelectSearch");
  const closeBtn = $("#platformSelectClose");

  if (!modal || !list) return;

  // 渲染平台列表
  function renderPlatformList(filter = "") {
    const filtered = filter
      ? platforms.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()) || (p.category || "").toLowerCase().includes(filter.toLowerCase()))
      : platforms;

    list.innerHTML = filtered.map(p => `
      <div class="platform-select-item" data-id="${p.id}">
        <span class="platform-select-item-name">${escapeHtml(p.name)}</span>
        <span class="platform-select-item-category">${escapeHtml(p.category || "")}</span>
      </div>
    `).join("");

    // 绑定点击事件
    list.querySelectorAll(".platform-select-item").forEach(el => {
      el.addEventListener("click", () => {
        const platformId = el.dataset.id;
        const platform = platforms.find(p => p.id === platformId);
        if (platform) {
          modal.style.display = "none";
          onSelect(platform);
        }
      });
    });
  }

  // 初始渲染
  renderPlatformList();

  // 搜索功能
  search.value = "";
  search.oninput = () => renderPlatformList(search.value);

  // 关闭按钮
  closeBtn.onclick = () => { modal.style.display = "none"; };

  // 点击背景关闭
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };

  // 显示模态框
  modal.style.display = "flex";
  search.focus();
}

// 工作流自动化：文章状态变为 "approved" 时，自动创建发布任务
async function autoCreatePublishTasks(articleId, productId, targetPlatform) {
  try {
    // 获取已启用的平台
    const enabledPlatforms = state.platforms.filter(p => p.status === "enabled");
    if (!enabledPlatforms.length) return;

    // 如果文章指定了目标平台，只创建该平台的任务
    let platformsToAssign = enabledPlatforms;
    if (targetPlatform) {
      const matchedPlatform = enabledPlatforms.find(p => p.name === targetPlatform);
      if (matchedPlatform) {
        platformsToAssign = [matchedPlatform];
      }
    }

    // 获取现有任务，避免重复创建
    const existingTasks = state.tasks || [];
    const articleTasks = existingTasks.filter(t => String(t.article_id) === String(articleId));
    const existingPlatformIds = new Set(articleTasks.map(t => String(t.platform_id)));

    // 创建新任务
    let created = 0;
    for (const platform of platformsToAssign) {
      if (existingPlatformIds.has(String(platform.id))) continue;

      try {
        await api("/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            article_id: String(articleId),
            platform_id: String(platform.id),
            status: "todo",
            notes: "文章审核通过，自动创建发布任务",
          }),
        });
        created++;
      } catch (e) {
        console.warn("自动创建发布任务失败：", platform.name, e.message);
      }
    }

    if (created > 0) {
      toast(`已自动创建 ${created} 个发布任务`, "success");
    }
  } catch (e) {
    console.warn("自动创建发布任务失败：", e.message);
  }
}

function buildWorkshopPrompt(product, types, platforms, notes) {
  const typesList = types.length ? types.join("、") : "产品软文";
  const platformsList = platforms.length ? platforms.join("、") : "通用平台";

  return `你是一个专业的中文内容创作者，请根据以下产品信息生成内容。

产品信息：
- 名称：${product.name || ""}
- 类型：${product.type || ""}
- 链接：${product.url || ""}
- 目标用户：${product.audience || ""}
- 核心卖点：${product.selling_points || ""}
- 竞品/替代品：${product.competitors || ""}
- 品牌语气：${product.tone || ""}
- 转化目标：${product.goal || ""}
- 禁用表达：${product.forbidden_words || ""}

内容类型：${typesList}
目标平台：${platformsList}
${notes ? `补充说明：${notes}` : ""}

要求：
1. 生成的内容要适配指定平台和内容类型的风格。
2. 语言自然、真实，避免广告感。
3. 不要编造不存在的数据、奖项、用户评价。
4. 适当使用 Markdown 格式排版（标题、列表、加粗等）。
5. 输出纯 Markdown 文本，不要 JSON 包装，不要多余解释。`;
}

async function workshopAiEdit(action) {
  const body = ($("#articleBody")?.value || "").trim();
  if (!body) return toast("内容为空", "error");

  const aiSettings = state.ai_settings || {};
  if (!aiSettings.text_api_key) return toast("请先配置 AI Key", "error");

  // 优先用关联产品；若未关联则回退到工坊选择的产品
  const articleProductId = ($("#articleProduct")?.value) || "";
  const workshopProductId = ($("#workshopProduct")?.value) || "";
  const pid = articleProductId || workshopProductId;
  const product = pid ? state.products.find(p => p.id === pid) : null;

  const actionLabel = action === "改写" ? "改写" : "扩写";
  const actionInst = action === "改写"
    ? "请用不同的表达方式改写以下内容，保留核心信息，提升可读性。"
    : "请在保留原有信息的基础上进行扩写，丰富细节、案例或论证，使内容更加充实。";

  let systemPrompt = `你是一个专业的中文内容创作者。${actionInst}`;
  if (product) {
    systemPrompt += `\n\n产品背景：名称：${product.name}，类型：${product.type}，品牌语气：${product.tone}，禁用表达：${product.forbidden_words}。`;
  }

  toast(`正在${actionLabel}...`);
  try {
    const raw = await callAI(aiSettings, [
      { role: "system", content: systemPrompt },
      { role: "user", content: body },
    ]);
    $("#articleBody").value = raw;
    renderPreview();
    toast(`内容已${actionLabel}`, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

// ===== User Model Events =================================================

$("#saveUserModelBtn").addEventListener("click", async () => {
  const btn = $("#saveUserModelBtn");
  if (isLoading(btn)) return;
  const id = $("#umId").value;
  const payload = {
    name: $("#umName").value,
    provider: $("#umProvider").value,
    text_base_url: $("#umTextBaseUrl").value,
    text_model: $("#umTextModel").value,
    text_api_key: $("#umTextApiKey").value,
    image_base_url: $("#umImageBaseUrl").value,
    image_model: $("#umImageModel").value,
    image_api_key: $("#umImageApiKey").value,
    temperature: Number($("#umTemperature").value || 0.7),
  };
  if (!payload.name) return toast("请输入模型名称", "error");
  setLoading(btn, true);
  try {
    if (id) {
      await api(`/api/user_models/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/user_models", { method: "POST", body: JSON.stringify(payload) });
    }
    resetUserModelForm();
    toast("模型已保存", "success");
    await load();
  } catch (e) {
    toast("保存失败：" + e.message, "error");
  } finally {
    setLoading(btn, false);
  }
});

// ===== Auth View =========================================================

function showAuthView() {
  $("#authView").style.display = "flex";
  $(".sidebar").style.display = "none";
  $("#sidebarToggle").style.display = "none";
  $(".user-info").style.display = "none";
}

function hideAuthView() {
  $("#authView").style.display = "none";
  $(".sidebar").style.display = "";
  $("#sidebarToggle").style.display = "";
  $(".user-info").style.display = "flex";
  $("#userNameDisplay").textContent = getCurrentUserName() || "";
}

function renderAuthView() {
  if (isLoggedIn()) {
    hideAuthView();
    $("#userNameDisplay").textContent = getCurrentUserName() || "";
  } else {
    showAuthView();
  }
}

// ===== User Model Helpers ================================================

function selectUserModel(id) {
  const m = state.user_models.find(x => x.id === id);
  if (!m) return;
  $("#umId").value = m.id;
  $("#umName").value = m.name || "";
  $("#umProvider").value = m.provider || "";
  $("#umTextBaseUrl").value = m.text_base_url || "";
  $("#umTextModel").value = m.text_model || "";
  $("#umTextApiKey").value = ""; // 不回填 Key
  $("#umImageBaseUrl").value = m.image_base_url || "";
  $("#umImageModel").value = m.image_model || "";
  $("#umImageApiKey").value = "";
  $("#umTemperature").value = m.temperature || 0.7;
}

function resetUserModelForm() {
  ["umId", "umName", "umProvider", "umTextBaseUrl", "umTextModel", "umTextApiKey", "umImageBaseUrl", "umImageModel", "umImageApiKey"].forEach(id => $(`#${id}`).value = "");
  $("#umTemperature").value = 0.7;
}

async function applyUserModelToSettings(id) {
  const m = state.user_models.find(x => x.id === id);
  if (!m) return;
  $("#aiMode").value = "api";
  $("#textBaseUrl").value = m.text_base_url || "";
  $("#textModel").value = m.text_model || "";
  $("#imageBaseUrl").value = m.image_base_url || "";
  $("#imageModel").value = m.image_model || "";
  const aiSettings = state.ai_settings || {};
  const payload = {
    mode: "api",
    text_base_url: m.text_base_url || "",
    text_model: m.text_model || "",
    image_base_url: m.image_base_url || "",
    image_model: m.image_model || "",
    temperature: m.temperature || 0.7,
  };
  if (m.text_api_key) payload.text_api_key = m.text_api_key;
  if (m.image_api_key) payload.image_api_key = m.image_api_key;
  try {
    if (aiSettings.id) {
      await geoApi(`/api/ai_settings/${aiSettings.id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await geoApi("/api/ai_settings", { method: "POST", body: JSON.stringify({ ...payload, mode: "api" }) });
    }
    toast(`已切换到模型：${m.name}`, "success");
    await load();
  } catch (err) {
    toast("切换模型失败：" + err.message, "error");
  }
}

// ===== Pre-registered Accounts ===========================================

const PRE_REGISTERED_ACCOUNTS = [
  { name: "用户001", email: "user001@geo.local", password: "test1234" },
  { name: "用户002", email: "user002@geo.local", password: "test1234" },
  { name: "用户003", email: "user003@geo.local", password: "test1234" },
  { name: "用户004", email: "user004@geo.local", password: "test1234" },
  { name: "用户005", email: "user005@geo.local", password: "test1234" },
];

function renderAccountChips() {
  const container = $("#accountChips");
  if (!container) return;
  container.innerHTML = PRE_REGISTERED_ACCOUNTS.map(a => `
    <div class="account-chip" data-email="${escapeHtml(a.email)}" data-password="${escapeHtml(a.password)}">
      ${escapeHtml(a.name)}
      <small>${escapeHtml(a.email)}</small>
    </div>
  `).join("");
}

// ===== 引导式向导 =========================================================

const WIZARD_STEPS = [
  {
    title: "欢迎使用 GEO Studio",
    content: `
      <h3>让 AI 帮你回答用户真正会问的问题</h3>
      <p>GEO Studio 是一个生成式搜索引擎优化（GEO）内容工作台，帮助你创建被 AI 引用的内容。</p>
      <div class="wizard-feature">
        <div class="wizard-feature-icon">📦</div>
        <div class="wizard-feature-text">
          <h4>产品档案</h4>
          <p>定义你的产品信息，作为内容生成的基础</p>
        </div>
      </div>
      <div class="wizard-feature">
        <div class="wizard-feature-icon">❓</div>
        <div class="wizard-feature-text">
          <h4>GEO 问题库</h4>
          <p>收集用户会问 AI 的问题，确保内容覆盖</p>
        </div>
      </div>
      <div class="wizard-feature">
        <div class="wizard-feature-icon">✨</div>
        <div class="wizard-feature-text">
          <h4>AI 内容生成</h4>
          <p>基于产品和问题，AI 自动生成高质量内容</p>
        </div>
      </div>
      <div class="wizard-feature">
        <div class="wizard-feature-icon">📊</div>
        <div class="wizard-feature-text">
          <h4>覆盖率分析</h4>
          <p>追踪哪些问题已被内容覆盖</p>
        </div>
      </div>
    `,
    action: null,
  },
  {
    title: "创建你的第一个产品",
    content: `
      <h3>从产品档案开始</h3>
      <p>产品档案是内容生成的基础。填写产品名称、类型、目标用户和核心卖点。</p>
      <div class="wizard-action" id="wizardCreateProduct">
        <span class="wizard-action-icon">📦</span>
        <span class="wizard-action-text">点击这里创建产品档案</span>
      </div>
      <p style="margin-top:16px;font-size:12px;color:var(--text-muted)">提示：你也可以在「产品档案」页面随时创建和编辑产品。</p>
    `,
    action: () => {
      showView("products");
      showProductEditMode({ id: "", name: "", type: "", url: "", audience: "", selling_points: "", competitors: "", tone: "真实、专业、克制", goal: "", forbidden_words: "" });
    },
  },
  {
    title: "配置 AI 设置",
    content: `
      <h3>连接 AI 模型</h3>
      <p>配置 AI API Key 后，系统可以直接调用大模型生成内容。</p>
      <div class="wizard-action" id="wizardConfigAI">
        <span class="wizard-action-icon">⚙️</span>
        <span class="wizard-action-text">点击这里配置 AI 设置</span>
      </div>
      <p style="margin-top:16px;font-size:12px;color:var(--text-muted)">支持智谱 GLM、OpenAI、DeepSeek 等多种模型。</p>
    `,
    action: () => {
      showView("settings");
    },
  },
  {
    title: "开始使用",
    content: `
      <h3>你已准备就绪！</h3>
      <p>现在你可以开始使用 GEO Studio 了。核心工作流程：</p>
      <div class="wizard-feature">
        <div class="wizard-feature-icon">1</div>
        <div class="wizard-feature-text">
          <h4>创建产品档案</h4>
          <p>填写产品信息，或让 AI 帮你梳理</p>
        </div>
      </div>
      <div class="wizard-feature">
        <div class="wizard-feature-icon">2</div>
        <div class="wizard-feature-text">
          <h4>生成 GEO 问题</h4>
          <p>收集用户会问 AI 的问题</p>
        </div>
      </div>
      <div class="wizard-feature">
        <div class="wizard-feature-icon">3</div>
        <div class="wizard-feature-text">
          <h4>AI 生成内容</h4>
          <p>在「内容工坊」中选择产品和平台，一键生成</p>
        </div>
      </div>
      <div class="wizard-feature">
        <div class="wizard-feature-icon">4</div>
        <div class="wizard-feature-text">
          <h4>发布并追踪</h4>
          <p>复制内容到平台发布，记录发布状态</p>
        </div>
      </div>
    `,
    action: null,
  },
];

let wizardCurrentStep = 0;

function initWizard() {
  // 检查是否已完成引导
  if (localStorage.getItem("geo_wizard_completed")) return;
  
  // 绑定事件
  $("#wizardNextBtn")?.addEventListener("click", wizardNext);
  $("#wizardPrevBtn")?.addEventListener("click", wizardPrev);
  $("#wizardSkipBtn")?.addEventListener("click", wizardSkip);
  
  // 显示引导
  showWizard();
}

function showWizard() {
  const overlay = $("#wizardOverlay");
  if (!overlay) return;
  overlay.style.display = "flex";
  wizardCurrentStep = 0;
  renderWizardStep();
}

function hideWizard() {
  const overlay = $("#wizardOverlay");
  if (!overlay) return;
  overlay.style.display = "none";
}

function renderWizardStep() {
  const step = WIZARD_STEPS[wizardCurrentStep];
  if (!step) return;
  
  // 更新标题
  $("#wizardTitle").textContent = step.title;
  
  // 更新进度
  const progress = ((wizardCurrentStep + 1) / WIZARD_STEPS.length) * 100;
  $("#wizardProgress").style.width = `${progress}%`;
  $("#wizardStepInfo").textContent = `步骤 ${wizardCurrentStep + 1} / ${WIZARD_STEPS.length}`;
  
  // 更新内容
  $("#wizardBody").innerHTML = step.content;
  
  // 绑定步骤内的action事件
  const actionEl = $("#wizardBody .wizard-action");
  if (actionEl && step.action) {
    actionEl.addEventListener("click", () => {
      step.action();
    });
  }
  
  // 更新按钮状态
  $("#wizardPrevBtn").style.display = wizardCurrentStep > 0 ? "" : "none";
  
  const nextBtn = $("#wizardNextBtn");
  if (wizardCurrentStep === WIZARD_STEPS.length - 1) {
    nextBtn.textContent = "完成";
    nextBtn.className = "btn primary accent";
  } else {
    nextBtn.textContent = "下一步";
    nextBtn.className = "btn primary";
  }
}

function wizardNext() {
  if (wizardCurrentStep < WIZARD_STEPS.length - 1) {
    wizardCurrentStep++;
    renderWizardStep();
  } else {
    wizardComplete();
  }
}

function wizardPrev() {
  if (wizardCurrentStep > 0) {
    wizardCurrentStep--;
    renderWizardStep();
  }
}

function wizardSkip() {
  wizardComplete();
}

function wizardComplete() {
  localStorage.setItem("geo_wizard_completed", "true");
  hideWizard();
  toast("引导完成！开始创建你的第一个产品吧", "success");
  showView("products");
}

// 页面加载时初始化引导
// 仅在用户确实没有产品时显示（新用户），已有数据的用户跳过
if (isLoggedIn() && !localStorage.getItem("geo_wizard_completed")) {
  setTimeout(() => {
    // 如果用户已有产品或文章，说明不是新用户，自动标记完成
    const hasContent = (state.products || []).length > 0 || (state.articles || []).length > 0;
    if (hasContent) {
      localStorage.setItem("geo_wizard_completed", "true");
    } else {
      initWizard();
    }
  }, 500);
}
