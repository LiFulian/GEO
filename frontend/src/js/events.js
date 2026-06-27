/* GEO Studio - Event binding with event delegation */

function bindEvents() {
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
  $("#refreshBtn").addEventListener("click", () => {
    setLoading($("#refreshBtn"), true);
    load().finally(() => setLoading($("#refreshBtn"), false));
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
    const backup = await api("/api/backup");
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `geo-backup-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  $("#importBackupBtn").addEventListener("click", () => $("#backupFile").click());
  $("#backupFile").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    toast("备份导入功能将在后续版本中重新支持", "error");
    event.target.value = "";
    // TODO: 实现 PocketBase 版本的备份导入
  });

  // --- Products ---
  $("#productForm").addEventListener("submit", async event => {
    event.preventDefault();
    const payload = formData(event.target);
    const id = Number(payload.id);
    delete payload.id;
    if (id) {
      await api(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/products", { method: "POST", body: JSON.stringify(payload) });
    }
    resetProductForm();
    toast("产品已保存", "success");
    await load();
  });
  $("#resetProductBtn").addEventListener("click", () => {
    if ($("#productForm").elements.name.value && !confirm("确定清空当前表单？")) return;
    resetProductForm();
  });

  // --- Product AI ---
  $("#productAiPromptBtn").addEventListener("click", async () => {
    const rawText = $("#productAiInput").value.trim();
    if (!rawText) return toast("请先输入产品描述", "error");
    const pid = Number($("#productId").value || 0);
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
      if (!aiSettings.text_api_key) return toast("请先在「内容生成」中配置 AI Key", "error");
      const pid = Number($("#productId").value || 0);
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
      applyProductSuggestion(parseJsonObjectText($("#productAiResult").value));
      toast("已应用到产品表单", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  // --- GEO Questions ---
  $("#geoQuestionForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = Number($("#geoQuestionId").value);
    const payload = {
      product_id: Number($("#geoProduct").value || 0),
      question: $("#geoQuestionText").value,
      intent: $("#geoIntent").value,
      audience: $("#geoAudience").value,
      priority: $("#geoPriority").value,
      status: $("#geoStatus").value,
      content_angle: $("#geoAngle").value,
      target_platform: $("#geoPlatform").value,
    };
    if (!payload.product_id) return toast("请先选择产品", "error");
    if (id) {
      await api(`/api/geo_questions/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/geo_questions", { method: "POST", body: JSON.stringify(payload) });
    }
    resetGeoQuestionForm();
    toast("GEO 问题已保存", "success");
    await load();
  });
  $("#resetGeoQuestionBtn").addEventListener("click", () => {
    if ($("#geoQuestionText").value && !confirm("确定清空当前表单？")) return;
    resetGeoQuestionForm();
  });
  $("#geoSearch").addEventListener("input", debounce(renderGeoQuestions, 200));
  $("#geoFilterProduct")?.addEventListener("change", renderGeoQuestions);

  $("#buildGeoPromptBtn").addEventListener("click", async () => {
    const productId = Number($("#geoPromptProduct").value);
    if (!productId) return toast("请先创建并选择产品", "error");
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
    const productId = Number($("#geoPromptProduct").value);
    if (!productId) return toast("请先选择产品", "error");
    const raw = $("#geoImportBox").value;
    if (!raw.trim()) return toast("请先粘贴 AI 返回的 JSON", "error");
    let parsed, imported = 0, skipped = 0;
    try {
      parsed = extractJsonArray(raw);
    } catch (err) {
      return toast("JSON 格式错误：" + err.message, "error");
    }
    for (const item of parsed) {
      const question = (item.question || item["问题"] || "").trim();
      if (!question) { skipped++; continue; }
      await geoApi("/api/geo_questions", {
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
    }
    $("#geoImportBox").value = "";
    toast(`已导入 ${imported} 个 GEO 问题${skipped ? "，" + skipped + " 条跳过" : ""}`, "success");
    await load();
  });

  // --- Generator ---
  $("#buildPromptBtn").addEventListener("click", async () => {
    const productId = Number($("#genProduct").value);
    if (!productId) return toast("请先创建并选择产品", "error");
    const product = state.products.find(p => p.id === productId);
    if (!product) return toast("未找到产品", "error");
    const count = Number($("#genCount").value || 10);
    const platformIds = selectedValues("#genPlatforms");
    const platforms = platformIds.length
      ? state.platforms.filter(p => platformIds.includes(p.id))
      : state.platforms.filter(p => p.status === "enabled").slice(0, 12);
    const contentTypes = selectedTextValues("#contentTypes");
    const questions = state.geo_questions.filter(q => q.product_id === productId && q.status === "active");
    const prompt = buildProductPrompt(product, platforms, count, contentTypes, questions);
    $("#promptBox").value = prompt;
    toast("Prompt 已生成", "success");
  });

  $("#copyPromptBtn").addEventListener("click", async () => {
    await copyToClipboard($("#promptBox").value);
    toast("Prompt 已复制", "success");
  });

  $("#saveAiBtn").addEventListener("click", async () => {
    const payload = {
      mode: $("#aiMode").value,
      text_base_url: $("#textBaseUrl").value,
      text_model: $("#textModel").value,
      image_base_url: $("#imageBaseUrl").value,
      image_model: $("#imageModel").value,
      temperature: Number($("#aiTemperature").value || 0.7),
    };
    if ($("#textKey").value) payload.text_api_key = $("#textKey").value;
    if ($("#imageKey").value) payload.image_api_key = $("#imageKey").value;
    // ai_settings 的 PocketBase record id
    const recordId = (state.ai_settings && state.ai_settings.id) || null;
    if (recordId) {
      await geoApi(`/api/ai_settings/${recordId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      // 没有则创建
      await geoApi("/api/ai_settings", { method: "POST", body: JSON.stringify({ ...payload, mode: payload.mode || "manual" }) });
    }
    $("#textKey").value = "";
    $("#imageKey").value = "";
    toast("AI 设置已保存", "success");
    await load();
  });

  $("#aiPreset").addEventListener("change", () => {
    const preset = aiPresets[Number($("#aiPreset").value)];
    if (!preset) return;
    $("#aiMode").value = "api";
    $("#textBaseUrl").value = preset.text_base_url || "";
    $("#textModel").value = preset.text_model || "";
    $("#imageBaseUrl").value = preset.image_base_url || "";
    $("#imageModel").value = preset.image_model || "";
  });

  $("#directAiBtn").addEventListener("click", async () => {
    const btn = $("#directAiBtn");
    if (isLoading(btn)) return;
    const productId = Number($("#genProduct").value);
    if (!productId) return toast("请先创建并选择产品", "error");
    const aiSettings = state.ai_settings || {};
    if (!aiSettings.text_api_key) return toast("请先配置 AI Key", "error");
    setLoading(btn);
    toast("正在调用模型，可能需要几十秒...");
    try {
      const product = state.products.find(p => p.id === productId);
      const platformIds = selectedValues("#genPlatforms");
      const platforms = platformIds.length
        ? state.platforms.filter(p => platformIds.includes(p.id))
        : state.platforms.filter(p => p.status === "enabled").slice(0, 12);
      const count = Number($("#genCount").value || 10);
      const contentTypes = selectedTextValues("#contentTypes");
      const questions = state.geo_questions.filter(q => q.product_id === productId && q.status === "active");
      const prompt = buildProductPrompt(product, platforms, count, contentTypes, questions);
      const raw = await callAI(aiSettings, [
        { role: "system", content: "你是一个严谨的中文内容运营专家，只输出可解析 JSON。" },
        { role: "user", content: prompt },
      ]);
      const parsed = extractJsonArray(raw);
      let imported = 0;
      for (const item of parsed) {
        const title = (item.title || item["标题"] || "").trim();
        if (!title) continue;
        let body = (item.body || item["正文"] || item.content || "").trim();
        if (!title && body) body.splitlines()[0].slice(0, 60); // fallback title
        await geoApi("/api/articles", {
          method: "POST",
          body: JSON.stringify({
            product_id: productId,
            geo_question_id: Number(item.geo_question_id || item["问题ID"] || item.question_id || 0),
            title,
            summary: (item.summary || item["摘要"] || "").slice(0, 500),
            body,
            content_type: item.content_type || item["内容类型"] || "",
            target_platform: item.target_platform || item["目标平台"] || "",
            keywords: item.keywords || item["关键词"] || "",
            tags: item.tags || item["标签"] || "",
            image_prompt: item.image_prompt || item["配图建议"] || "",
            risk_notes: item.risk_notes || item["风险提示"] || "",
            status: "draft",
          }),
        });
        imported++;
      }
      toast(`已导入 ${imported} 篇文章`, "success");
      await load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(btn, false);
    }
  });

  $("#importAiBtn").addEventListener("click", async () => {
    const productId = Number($("#genProduct").value);
    if (!productId) return toast("请先创建并选择产品", "error");
    const raw = $("#aiResultBox").value;
    if (!raw.trim()) return toast("请先粘贴 AI 返回的 JSON", "error");
    let parsed, imported = 0;
    try {
      parsed = extractJsonArray(raw);
    } catch (err) {
      return toast("JSON 格式错误：" + err.message, "error");
    }
    for (const item of parsed) {
      const title = (item.title || item["标题"] || "").trim();
      if (!title) continue;
      await geoApi("/api/articles", {
        method: "POST",
        body: JSON.stringify({
          product_id: productId,
          geo_question_id: Number(item.geo_question_id || item["问题ID"] || item.question_id || 0),
          title,
          summary: (item.summary || item["摘要"] || "").slice(0, 500),
          body: (item.body || item["正文"] || item.content || "").trim(),
          content_type: item.content_type || item["内容类型"] || "",
          target_platform: item.target_platform || item["目标平台"] || "",
          keywords: item.keywords || item["关键词"] || "",
          tags: item.tags || item["标签"] || "",
          image_prompt: item.image_prompt || item["配图建议"] || "",
          risk_notes: item.risk_notes || item["风险提示"] || "",
          status: "draft",
        }),
      });
      imported++;
    }
    $("#aiResultBox").value = "";
    toast(`已导入 ${imported} 篇文章`, "success");
    await load();
  });

  $("#adaptPromptBtn").addEventListener("click", async () => {
    const articleId = Number($("#adaptArticle").value);
    const platformId = Number($("#adaptPlatform").value);
    if (!articleId || !platformId) return toast("请选择文章和平台", "error");
    const article = state.articles.find(a => a.id === articleId);
    const platform = state.platforms.find(p => p.id === platformId);
    if (!article || !platform) return toast("文章或平台未找到", "error");
    const product = state.products.find(p => p.id === article.product_id);
    const prompt = buildAdaptationPrompt(article, platform, product || null);
    $("#promptBox").value = prompt;
    await copyToClipboard(prompt);
    toast("适配 Prompt 已生成并复制", "success");
  });

  // --- Articles ---
  $("#newArticleBtn").addEventListener("click", () => {
    state.selectedArticleId = null;
    state.selectedArticleProductId = null;
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

  // Markdown 工具栏
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
    const id = Number($("#articleId").value);
    const payload = {
      product_id: Number($("#articleProduct").value) || 0,
      geo_question_id: Number($("#articleGeoQuestion").value) || 0,
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
    if (id) {
      await api(`/api/articles/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      const article = await api("/api/articles", { method: "POST", body: JSON.stringify(payload) });
      state.selectedArticleId = article.id;
      state.selectedArticleProductId = article.product_id;
    }
    clearArticleDraft();
    toast("文章已保存", "success");
    setArticleEditorMode(true);
    await load();
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
    const articleId = Number($("#articleId").value);
    if (!prompt && articleId) {
      const article = state.articles.find(a => a.id === articleId);
      prompt = article ? ((article.image_prompt || "") || (article.title || "") + "。" + (article.summary || "")) : "";
    }
    if (!prompt) return toast("请先填写配图建议或选择文章", "error");
    if (!state.ai_settings?.image_model) return toast("请先在「内容生成 → AI 设置」中配置图片生成模型", "error");
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
    const id = Number($("#articleId").value);
    if (!id) return toast("请先选择文章", "error");
    if (!confirm("确定删除该文章？")) return;
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
    const productId = Number($("#articleProduct").value || 0);
    const qs = state.geo_questions.filter(q => !productId || q.product_id === productId);
    const cur = agEl.value;
    agEl.innerHTML = `<option value="0">未关联（不影响覆盖率统计）</option>` +
      qs.map(q => `<option value="${q.id}">${escapeHtml(q.question)}</option>`).join("");
    // 选项被清空就回退到 0
    agEl.value = qs.some(q => String(q.id) === cur) ? cur : "0";
  });

  // --- Platforms ---
  $("#platformSearch").addEventListener("input", debounce(renderPlatforms, 200));
  $("#taskSearch").addEventListener("input", debounce(renderTasks, 200));
  $("#taskBoardViewBtn")?.addEventListener("click", () => { state.taskView = "board"; renderTasks(); });
  $("#taskCalendarViewBtn")?.addEventListener("click", () => { state.taskView = "calendar"; renderTasks(); });

  $("#articleSearch")?.addEventListener("input", debounce(renderArticles, 200));
  $("#articleFilterProduct")?.addEventListener("change", renderArticles);
  $("#articleFilterStatus")?.addEventListener("change", renderArticles);

  $("#platformForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = Number($("#platformId").value);
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
    if (id) {
      await api(`/api/platforms/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/platforms", { method: "POST", body: JSON.stringify(payload) });
    }
    toast("平台已保存", "success");
    resetPlatformForm();
    await load();
  });
  $("#resetPlatformBtn").addEventListener("click", () => {
    if ($("#platformName").value && !confirm("确定清空当前表单？")) return;
    resetPlatformForm();
  });

  // --- Global Search ---
  bindGlobalSearchEvents();

  // --- Tasks ---
  $("#assignTasksBtn").addEventListener("click", async () => {
    const article_ids = selectedValues("#taskArticlePicker");
    const platform_ids = selectedValues("#taskPlatformPicker");
    if (!article_ids.length || !platform_ids.length) return toast("请选择文章和平台", "error");
    const data = await api("/api/tasks/assign", { method: "POST", body: JSON.stringify({ article_ids, platform_ids }) });
    const msg = data.skipped > 0
      ? `新增 ${data.created.length} 个任务（跳过 ${data.skipped} 个已存在）`
      : `新增 ${data.created.length} 个发布任务`;
    toast(msg, "success");
    await load();
  });

  // --- Global Search ---
let globalSearchIndex = -1;
let globalSearchResults = [];

function buildGlobalSearchIndex() {
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
  return index;
}

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
  else if (item.type === "geo_question") { showView("geo"); selectGeoQuestion(item.id); }
  else if (item.type === "article") { showView("articles"); selectArticle(item.id); }
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

// --- Keyboard Shortcuts ---
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "s") {
      e.preventDefault();
      const activeView = $(".view.active");
      if (activeView?.id === "articles") {
        $("#saveArticleBtn").click();
      } else if (activeView?.id === "products") {
        $("#saveProductBtn").click();
      }
    }
    // Ctrl+L 刷新数据（避免与浏览器 Ctrl+R 刷新冲突）
    if (e.key === "l") {
      e.preventDefault();
      load();
    }
    // Cmd/Ctrl+K 聚焦全局搜索
    if (e.key === "k") {
      e.preventDefault();
      $("#globalSearch")?.focus();
    }
  }
});
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
    selectArticle(Number(articleRow.dataset.id));
    return;
  }

  // Empty-state jump buttons
  const jumpBtn = el.closest("[data-action='jump']");
  if (jumpBtn) {
    showView(jumpBtn.dataset.target);
    return;
  }

  // Calendar task click
  const calTask = el.closest(".calendar-task");
  if (calTask && calTask.dataset.id) {
    state.taskView = "board";
    renderTasks();
    return;
  }

  if (!btn) return;

  // Product list actions
  if (btn.classList.contains("edit-product")) {
    e.stopPropagation();
    selectProduct(Number(btn.dataset.id));
    return;
  }
  if (btn.classList.contains("use-product")) {
    e.stopPropagation();
    showView("generator");
    $("#genProduct").value = btn.dataset.id;
    return;
  }
  if (btn.classList.contains("delete-product")) {
    e.stopPropagation();
    if (!confirm("确定删除该产品？")) return;
    await api(`/api/products/${btn.dataset.id}`, { method: "DELETE" });
    toast("产品已删除", "success");
    await load();
    return;
  }

  // GEO question actions
  if (btn.classList.contains("edit-geo-question")) {
    selectGeoQuestion(Number(btn.dataset.id));
    return;
  }
  if (btn.classList.contains("cover-geo-question")) {
    await api(`/api/geo_questions/${btn.dataset.id}`, { method: "PUT", body: JSON.stringify({ status: "covered" }) });
    toast("已标记为覆盖", "success");
    await load();
    return;
  }
  if (btn.classList.contains("delete-geo-question")) {
    if (!confirm("确定删除这个 GEO 问题？")) return;
    await api(`/api/geo_questions/${btn.dataset.id}`, { method: "DELETE" });
    toast("GEO 问题已删除", "success");
    await load();
    return;
  }

  // Platform actions
  if (btn.classList.contains("open-platform")) {
    window.open(btn.dataset.url, "_blank");
    return;
  }
  if (btn.classList.contains("edit-platform")) {
    selectPlatform(Number(btn.dataset.id));
    return;
  }
  if (btn.classList.contains("toggle-platform")) {
    await api(`/api/platforms/${btn.dataset.id}`, { method: "PUT", body: JSON.stringify({ status: btn.dataset.status }) });
    await load();
    return;
  }
  if (btn.classList.contains("delete-platform")) {
    if (!confirm("确定删除该平台？")) return;
    await api(`/api/platforms/${btn.dataset.id}`, { method: "DELETE" });
    toast("平台已删除", "success");
    await load();
    return;
  }

  // Task actions
  if (btn.classList.contains("task-status")) {
    const id = btn.dataset.id;
    const body = { status: btn.dataset.status };
    const urlInput = $(`#publishedUrl-${id}`);
    if (urlInput) body.published_url = urlInput.value;
    if (btn.dataset.status === "published" && !body.published_at) body.published_at = formatLocalNow();
    await api(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(body) });
    toast("发布状态已更新", "success");
    await load();
    return;
  }
  if (btn.classList.contains("task-open")) {
    window.open(btn.dataset.url, "_blank");
    return;
  }
  if (btn.classList.contains("task-copy")) {
    const task = state.tasks.find(item => item.id === Number(btn.dataset.id));
    if (!task) return;
    await copyToClipboard(taskCopyText(task, btn.dataset.kind));
    toast("发布素材已复制", "success");
    return;
  }
  if (btn.classList.contains("task-delete")) {
    if (!confirm("确定删除该任务？")) return;
    await api(`/api/tasks/${btn.dataset.id}`, { method: "DELETE" });
    toast("任务已删除", "success");
    await load();
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

}
