/// <reference path="../pb_data/types.d.ts" />
//
// Schema 一致性补丁：给 user_models 与 product_images 补上 created_at / updated_at 文本字段。
//
// 背景：这两个集合在初始迁移里没有时间字段（其它业务集合都有），导致：
//   • 前端 pbRecordToApp 拿不到时间戳，记录的 created_at/updated_at 永远为空字符串；
//   • GET /api/<coll>?sort=-updated_at 会返回 400（字段不存在）；
//   • 与 project memory 约定「所有 schema 包含 created_at/updated_at」相违。
// 这里采用幂等 add-if-missing 写法，对线上库无破坏。
//
migrate((app) => {
  const TARGETS = ["user_models", "product_images"];

  for (const name of TARGETS) {
    let c;
    try {
      c = app.findCollectionByNameOrId(name);
    } catch (e) {
      continue; // 集合不存在则跳过
    }
    let changed = false;
    if (!c.fields.some(f => f.name === "created_at")) {
      c.fields.add(new Field({
        autogeneratePattern: "", hidden: false,
        id: "text" + String(9400000000 + Math.floor(Math.random() * 1000000)),
        max: 0, min: 0, name: "created_at",
        pattern: "", presentable: false, primaryKey: false,
        required: false, system: false, type: "text",
      }));
      changed = true;
    }
    if (!c.fields.some(f => f.name === "updated_at")) {
      c.fields.add(new Field({
        autogeneratePattern: "", hidden: false,
        id: "text" + String(9500000000 + Math.floor(Math.random() * 1000000)),
        max: 0, min: 0, name: "updated_at",
        pattern: "", presentable: false, primaryKey: false,
        required: false, system: false, type: "text",
      }));
      changed = true;
    }
    if (changed) app.save(c);
  }
}, (app) => {
  // 回滚：移除添加的字段
  for (const name of ["user_models", "product_images"]) {
    let c;
    try { c = app.findCollectionByNameOrId(name); } catch (e) { continue; }
    for (const fname of ["created_at", "updated_at"]) {
      const f = c.fields.find(x => x.name === fname);
      if (f) c.fields.remove(f);
    }
    app.save(c);
  }
})
