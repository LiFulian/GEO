/// <reference path="../pb_data/types.d.ts" />
//
// 给 products 集合补 status 字段（active / draft / paused / archived）。
//
// 背景：前端产品列表副标题、详情状态标签、深度编辑页的 pdStatus 都依赖 product.status，
// 但 products 建表迁移从未包含该字段 → product.status 恒为 undefined，
// 导致所有产品在列表里都被显示成"归档"。本迁移补上字段。
//
// 历史记录：新增字段后旧记录 status 为空字符串，由前端兜底为 active（运营中），无需回填。
// 幂等：字段已存在则跳过。
//
migrate((app) => {
  let products = null;
  try { products = app.findCollectionByNameOrId("products"); } catch (e) { return; }
  if (!products) return;
  if (products.fields.some(f => f.name === "status")) return;

  products.fields.add(new Field({
    id: "text9500000001",
    name: "status",
    type: "text",
    required: false,
    system: false,
    presentable: false,
    hidden: false,
    autogeneratePattern: "",
    pattern: "",
    max: 0,
    min: 0,
  }));
  app.save(products);
}, (app) => {
  // 回滚：移除 status 字段（会丢弃已写入值，仅用于开发回退；API 不确定时静默失败）
  let products = null;
  try { products = app.findCollectionByNameOrId("products"); } catch (e) { return; }
  if (!products) return;
  try { products.fields.remove("status"); app.save(products); } catch (e) {}
})
