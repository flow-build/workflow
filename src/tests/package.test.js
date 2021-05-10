const _ = require("lodash");
const uuid = require("uuid/v1");
const { setEngine,
        setCockpit } = require("../engine");
const { Engine,
        Cockpit } = require('@flowbuild/engine');
const { db_config, db } = require("./utils/db");
const { startServer } = require("../app");
const { valid_token,
        actor_data } = require("./utils/samples");
const { package_dtos,
        packageRequests } = require("./utils/package_requests");

const engine = new Engine("knex", db);
const cockpit = new Cockpit("knex", db);
setEngine(engine);
setCockpit(cockpit);

let server;
let requests;

beforeAll(() => {
  server = startServer(3001);
  const auth_header = ["Authorization", "Bearer " + valid_token];
  requests = packageRequests(server, auth_header);
});

beforeEach(async () => {
  await _clean();
});

afterEach(async () => {
  await db.delete()
          .from("packages")
          .where("name", "package_test_1");
});

afterAll(async () => {
  await _clean();
  await db.destroy();
  server.close();
});

describe("savePackage endpoint should work", () => {
  test("should return 201 for valid input", async () => {
    const res = await requests.savePackage(package_dtos.package_test_1);
    expect(res.statusCode).toBe(201);
    const package_ = res.body;
    expect(package_.package_id).toBeDefined();
    expect(package_.package_url).toBeDefined();
  });

  test("should return 400 for repeated input", async () => {
    const package_sample = package_dtos.package_test_1;
    let res = await requests.savePackage(package_sample);
    expect(res.statusCode).toBe(201);
    const package_ = res.body;
    expect(package_.package_id).toBeDefined();
    expect(package_.package_url).toBeDefined();
    res = await requests.savePackage(package_sample);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("should return 400 for invalid requests", async () => {
    const package_sample = {invalid: "any invalid input"}
    const res = await requests.savePackage(package_sample);
    expect(res.statusCode).toBe(400);
  });
});

describe("fetchPackage endpoint should work", () => {
  test("should return 200 for existent id", async () => {
    const package_sample = package_dtos.package_test_1;
    let res = await requests.savePackage(package_sample);
    expect(res.statusCode).toBe(201);
    const package_ = res.body;
    expect(package_.package_id).toBeDefined();
    expect(package_.package_url).toBeDefined();
    res = await requests.fetchPackage(package_.package_id);
    const fetched_package = res.body;
    expect(fetched_package.name).toBe(package_sample.name);
    expect(fetched_package.description).toBe(package_sample.description);
  });

  test("should return 404 for inexistent uuid", async () => {
    res = await requests.fetchPackage(uuid());
    expect(res.statusCode).toBe(404);
  });

  test("should return 404 for invalid uuid type", async () => {
    res = await requests.fetchPackage("invalid_uuid_type");
    expect(res.statusCode).toBe(404);
  });
});

describe("deletePackage endpoint should work", () => {
  test("should return 204 when succeeding", async () => {
    let res = await requests.savePackage(package_dtos.package_test_1);
    expect(res.statusCode).toBe(201);
    const package_ = res.body;
    expect(package_.package_id).toBeDefined();
    expect(package_.package_url).toBeDefined();
    res = await requests.deletePackage(package_.package_id);
    expect(res.statusCode).toBe(204);
  });

  test("should return 404 for inexistent package", async () => {
    const res = await requests.deletePackage(uuid());
    expect(res.statusCode).toBe(404);
  });

  test("should return 404 for invalid uuid", async () => {
    let res = await requests.savePackage(package_dtos.package_test_1);
    expect(res.statusCode).toBe(201);
    const package_ = res.body;
    expect(package_.package_id).toBeDefined();
    expect(package_.package_url).toBeDefined();
    res = await requests.deletePackage("invalid_uuid_type");
    expect(res.statusCode).toBe(404);
  });
});

const _clean = async () => {
  await db("process_state").del();
  await db("process").del();
  await db("workflow").del();
};
