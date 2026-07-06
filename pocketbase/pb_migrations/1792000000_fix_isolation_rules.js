/// <reference path="../pb_data/types.d.ts" />
//
// 安全补丁：统一收口所有业务集合的 API 规则。
//
// 背景：线上 data.db 曾通过 Admin UI 被改坏——6 个集合的 list/view 退化为
//   `@request.auth.id != ""`（只校验登录，丢掉了 user_id 过滤），导致任意已登录用户
//   可读取其他用户的全部业务数据；同时所有集合的 createRule 未校验 body.user_id，
//   可被跨用户注入/投毒。本迁移把规则写回迁移文件，作为线上 schema 的真值。
//
// 运行：下次 `pocketbase serve` 自动应用（文件名时间戳 1792000000 为目前最大）。
//
migrate((app) => {
  const listRule = '@request.auth.id != "" && user_id = @request.auth.id';
  const createRule = '@request.auth.id != "" && @request.body.user_id = @request.auth.id';

  const collections = [
    "products", "geo_questions", "platforms", "articles", "publish_tasks",
    "ai_settings", "user_models", "product_images",
  ];

  for (const name of collections) {
    let c;
    try {
      c = app.findCollectionByNameOrId(name);
    } catch (e) {
      continue; // 集合不存在则跳过（容错）
    }
    c.listRule = listRule;
    c.viewRule = listRule;
    c.createRule = createRule;   // 防止跨用户注入：写入时强制 body.user_id 与登录者一致
    c.updateRule = listRule;
    c.deleteRule = listRule;
    app.save(c);
  }
}, (app) => {
  // 回滚（不建议）：恢复为仅校验登录
  const authOnly = '@request.auth.id != ""';
  const collections = [
    "products", "geo_questions", "platforms", "articles", "publish_tasks",
    "ai_settings", "user_models", "product_images",
  ];
  for (const name of collections) {
    let c;
    try {
      c = app.findCollectionByNameOrId(name);
    } catch (e) {
      continue;
    }
    c.listRule = authOnly;
    c.viewRule = authOnly;
    c.createRule = authOnly;
    c.updateRule = authOnly;
    c.deleteRule = authOnly;
    app.save(c);
  }
})
