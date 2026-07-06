/// <reference path="../pb_data/types.d.ts" />
//
// AI 代理：浏览器 → PocketBase(同源) → 第三方 AI 厂商
//
// 解决浏览器直连 OpenAI / DeepSeek / 通义 / 豆包 等厂商时的 CORS 限制。
// 前端 callAI / callImageGeneration 把 {url, method, headers, body} POST 到 /api/ai/proxy，
// 本 hook 在服务端转发并把上游响应原样返回；若本 hook 未挂载，前端会回退到浏览器直连
// （兼容仅部署了静态前端、或厂商本身允许跨域的场景，如智谱 GLM）。
//
// 安全：路由加了 requireAuth() 中间件，仅登录用户可调用，避免成为开放代理。
//
routerAdd("POST", "/api/ai/proxy", (e) => {
  const info = e.requestInfo();
  const payload = info.body || {};
  const url = payload.url || "";
  const method = (payload.method || "POST").toUpperCase();
  const headers = payload.headers || { "Content-Type": "application/json" };
  const body = payload.body;

  // 仅放行 http(s)，阻断内网/文件协议（基础 SSRF 防护）
  if (!/^https?:\/\//i.test(url)) {
    return e.json(400, { error: { message: "仅允许 http(s) 目标地址" } });
  }

  let res;
  try {
    res = $http.send({
      url: url,
      method: method,
      headers: headers,
      body: typeof body === "string" ? body : JSON.stringify(body || {}),
      timeout: 120,
    });
  } catch (err) {
    return e.json(502, { error: { message: "上游请求失败：" + err } });
  }

  // 透传上游状态码与响应体（res.json 已是解析后的对象/数组；非 JSON 时回退空对象）
  const out = res.json != null ? res.json : {};
  return e.json(res.statusCode || 200, out);
}, $apis.requireAuth());
