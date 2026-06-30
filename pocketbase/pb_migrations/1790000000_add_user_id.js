/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collections = ["products", "geo_questions", "platforms", "articles", "publish_tasks", "ai_settings"];

  for (const name of collections) {
    const collection = app.findCollectionByNameOrId(name);
    const hasField = collection.fields.some(function(f) { return f.name === "user_id"; });
    if (!hasField) {
      collection.fields.add(new Field({
        autogeneratePattern: "",
        hidden: false,
        id: "text" + String(9000000000 + Math.floor(Math.random() * 100000000)),
        max: 0,
        min: 0,
        name: "user_id",
        pattern: "",
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: "text",
      }));
      app.save(collection);
    }
  }

  // Set rules
  const rule = '@request.auth.id != "" && user_id = @request.auth.id';
  for (const name2 of collections) {
    const c2 = app.findCollectionByNameOrId(name2);
    c2.listRule = rule;
    c2.viewRule = rule;
    c2.createRule = '@request.auth.id != ""';
    c2.updateRule = rule;
    c2.deleteRule = rule;
    app.save(c2);
  }

  // user_models rules
  const userModels = app.findCollectionByNameOrId("user_models");
  if (userModels) {
    userModels.listRule = rule;
    userModels.viewRule = rule;
    userModels.createRule = '@request.auth.id != ""';
    userModels.updateRule = rule;
    userModels.deleteRule = rule;
    app.save(userModels);
  }
}, (app) => {
  const collections = ["products", "geo_questions", "platforms", "articles", "publish_tasks", "ai_settings"];
  for (const name of collections) {
    const c = app.findCollectionByNameOrId(name);
    const field = c.fields.find(function(f) { return f.name === "user_id"; });
    if (field) {
      c.fields.remove(field);
      app.save(c);
    }
  }
})
