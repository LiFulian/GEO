/// <reference path="../pb_data/types.d.ts" />
//
// skills 集合：用户可装载的 AI Skill（纯 Markdown 知识/模板）
//
migrate((app) => {
  let c = null;
  try { c = app.findCollectionByNameOrId("skills"); } catch (e) {}
  if (c) return; // 已存在

  c = new Collection({
    name: "skills",
    type: "base",
    listRule:   '@request.auth.id != "" && user_id = @request.auth.id',
    viewRule:   '@request.auth.id != "" && user_id = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user_id = @request.auth.id',
    updateRule: '@request.auth.id != "" && user_id = @request.auth.id',
    deleteRule: '@request.auth.id != "" && user_id = @request.auth.id',
    fields: [
      { autogeneratePattern: "[a-z0-9]{15}", hidden: false, id: "text3208210256", max: 15, min: 15, name: "id", pattern: "^[a-z0-9]+$", presentable: false, primaryKey: true, required: true, system: true, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9400000001", max: 0, min: 0, name: "user_id", presentable: false, required: true, system: false, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9400000002", max: 0, min: 0, name: "name", presentable: true, required: true, system: false, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9400000003", max: 0, min: 0, name: "description", presentable: false, required: false, system: false, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9400000004", max: 0, min: 0, name: "category", presentable: false, required: false, system: false, type: "text" },
      { hidden: false, id: "editor940000005", name: "content", presentable: false, required: false, system: false, type: "editor" },
      { hidden: false, id: "bool940000006", name: "is_preset", presentable: false, required: false, system: false, type: "bool" },
      { autogeneratePattern: "", hidden: false, id: "text9400000007", max: 0, min: 0, name: "created_at", presentable: false, required: false, system: false, type: "text" },
      { autogeneratePattern: "", hidden: false, id: "text9400000008", max: 0, min: 0, name: "updated_at", presentable: false, required: false, system: false, type: "text" },
    ],
    indexes: [
      "CREATE INDEX `idx_skills_user` ON `skills` (`user_id`)",
      "CREATE UNIQUE INDEX `idx_skills_user_name` ON `skills` (`user_id`, `name`)",
    ],
  });
  app.save(c);
}, (app) => {
  let c = null;
  try { c = app.findCollectionByNameOrId("skills"); } catch (e) {}
  if (c) app.delete(c);
})
