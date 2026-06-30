/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // 1. 产品表：添加 description (MD) 字段
  const products = app.findCollectionByNameOrId("products");
  if (!products.fields.some(function(f) { return f.name === "description"; })) {
    products.fields.add(new Field({
      autogeneratePattern: "", hidden: false,
      id: "text" + String(9100000000 + Math.floor(Math.random() * 1000000)),
      max: 0, min: 0, name: "description",
      pattern: "", presentable: false, primaryKey: false,
      required: false, system: false, type: "text",
    }));
    app.save(products);
  }

  // 2. 文章表：添加 type 字段
  const articles = app.findCollectionByNameOrId("articles");
  if (!articles.fields.some(function(f) { return f.name === "type"; })) {
    articles.fields.add(new Field({
      autogeneratePattern: "", hidden: false,
      id: "text" + String(9100000000 + Math.floor(Math.random() * 1000000)),
      max: 0, min: 0, name: "type",
      pattern: "", presentable: false, primaryKey: false,
      required: false, system: false, type: "text",
    }));
    app.save(articles);
  }

  // 3. 创建 product_images 集合
  var imageCollection = null;
  try { imageCollection = app.findCollectionByNameOrId("product_images"); } catch(e) {}
  if (!imageCollection) {
    imageCollection = new Collection({
      name: "product_images",
      type: "base",
      listRule: '@request.auth.id != "" && user_id = @request.auth.id',
      viewRule: '@request.auth.id != "" && user_id = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && user_id = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user_id = @request.auth.id',
      fields: [
        { autogeneratePattern: "[a-z0-9]{15}", hidden: false, id: "text3208210256", max: 15, min: 15, name: "id", pattern: "^[a-z0-9]+$", presentable: false, primaryKey: true, required: true, system: true, type: "text" },
        { autogeneratePattern: "", hidden: false, id: "text" + String(9200000001), max: 0, min: 0, name: "user_id", presentable: false, required: true, system: false, type: "text" },
        { autogeneratePattern: "", hidden: false, id: "text" + String(9200000002), max: 0, min: 0, name: "product_id", presentable: false, required: true, system: false, type: "text" },
        { hidden: false, id: "file" + String(9200000003), maxSelect: 1, maxSize: 52428800, mimeTypes: ["image/jpeg","image/png","image/svg+xml","image/gif","image/webp","image/avif"], name: "image", presentable: false, required: false, system: false, type: "file" },
        { autogeneratePattern: "", hidden: false, id: "text" + String(9200000004), max: 0, min: 0, name: "description", presentable: false, required: false, system: false, type: "text" },
        { hidden: false, id: "number" + String(9200000005), max: null, min: null, name: "sort_order", onlyInt: true, presentable: false, required: false, system: false, type: "number" },
      ],
    });
    app.save(imageCollection);
  }

  // 4. 用户表：添加 avatar 字段（如果还没有）
  var users = null;
  try { users = app.findCollectionByNameOrId("users"); } catch(e) {}
  if (users && !users.fields.some(function(f) { return f.name === "avatar"; })) {
    users.fields.add(new Field({
      hidden: false, id: "file" + String(9300000001),
      maxSelect: 1, maxSize: 5242880,
      mimeTypes: ["image/jpeg","image/png","image/svg+xml","image/gif","image/webp"],
      name: "avatar", presentable: false, required: false, system: false, type: "file",
    }));
    app.save(users);
  }
}, (app) => {
  // Down migration
  var img = app.findCollectionByNameOrId("product_images");
  app.delete(img);
})
