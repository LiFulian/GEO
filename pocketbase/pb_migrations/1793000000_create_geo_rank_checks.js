/// <reference path="../pb_data/types.d.ts" />
//
// GEO 排名检测记录集合
// 闭环产品的核心：记录"AI 是否在回答某个 GEO 问题时引用了我们的产品"。
// 每次检测写入一条记录（保留历史，可看引用率趋势）；同一 (product, question) 可多次检测。
//
migrate((app) => {
  let c = null;
  try { c = app.findCollectionByNameOrId("geo_rank_checks"); } catch (e) {}
  if (c) return; // 已存在

  c = new Collection({
    name: "geo_rank_checks",
    type: "base",
    listRule:   '@request.auth.id != "" && user_id = @request.auth.id',
    viewRule:   '@request.auth.id != "" && user_id = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user_id = @request.auth.id',
    updateRule: '@request.auth.id != "" && user_id = @request.auth.id',
    deleteRule: '@request.auth.id != "" && user_id = @request.auth.id',
    fields: [
      { autogeneratePattern: "[a-z0-9]{15}", hidden: false, id: "text3208210256", max: 15, min: 15, name: "id", pattern: "^[a-z0-9]+$", presentable: false, primaryKey: true, required: true, system: true, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9300000001", max: 0, min: 0, name: "user_id", presentable: false, required: true, system: false, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9300000002", max: 0, min: 0, name: "product_id", presentable: false, required: true, system: false, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9300000003", max: 0, min: 0, name: "geo_question_id", presentable: false, required: true, system: false, type: "text" },
      { hidden: false, id: "bool9300000004", name: "cited", presentable: false, required: false, system: false, type: "bool" },
      { hidden: false, id: "number9300000005", max: null, min: null, name: "rank", onlyInt: true, presentable: false, required: false, system: false, type: "number" },
      { autogeneratePattern: "", hidden: false, id: "text9300000006", max: 0, min: 0, name: "snippet", presentable: false, required: false, system: false, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9300000007", max: 0, min: 0, name: "raw_response", presentable: false, required: false, system: false, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9300000008", max: 0, min: 0, name: "engine", presentable: false, required: false, system: false, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9300000009", max: 0, min: 0, name: "created_at", presentable: false, required: false, system: false, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9300000010", max: 0, min: 0, name: "updated_at", presentable: false, required: false, system: false, type: "text" },
    ],
  });
  app.save(c);
}, (app) => {
  let c = null;
  try { c = app.findCollectionByNameOrId("geo_rank_checks"); } catch (e) {}
  if (c) app.delete(c);
})
