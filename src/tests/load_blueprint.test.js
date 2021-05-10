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
const { workflow_dtos,
        workflowRequests } = require("./utils/workflow_requests");
const { processRequests } = require("./utils/process_request");
const extra_nodes = require("../utils/extra_nodes");

const test_blueprint = require("../../db/seeds/blueprints/test_workflow_blueprint");
const test_wf = {
  name: "test_workflow",
  description: "Workflow para rodar testes sobre a aplicação",
  blueprint_spec: test_blueprint
}

const engine = new Engine("knex", db);
engine.addCustomSystemCategory(extra_nodes);
const cockpit = new Cockpit("knex", db);
cockpit.addCustomSystemCategory(extra_nodes);
setEngine(engine);
setCockpit(cockpit);

let server;
let workflow_requests;
let process_requests;

const continue_request = {
    keyword: "continue",
    n_js: 2,
    n_interp: 2
}

const end_request = {
    keyword: "end",
    n_js: 2,
    n_interp: 2
}

beforeAll(() => {
  server = startServer(3001);
  const auth_header = ["Authorization", "Bearer " + valid_token];
  workflow_requests = workflowRequests(server, auth_header);
  process_requests = processRequests(server, auth_header);
});

beforeEach(async () => {
  await _clean();
});

afterAll(async () => {
  await _clean();
  await db.destroy();
  server.close();
});

test("workflow should go back to 2º node correctly", async () => {
  let response = await workflow_requests.save(test_wf);
  const wf_id = response.body.workflow_id;
  response = await workflow_requests.createProcess(wf_id, null);
  const process_id = response.body.process_id;

  await process_requests.runProcess(process_id, {input: {}});
  response = await process_requests.fetchState(process_id);
  expect(response.body.state.status).toBe("waiting");

  await process_requests.runProcess(process_id, continue_request);
  response = await process_requests.fetchState(process_id);
  expect(response.body.state.status).toBe("waiting");
  expect(response.body.state.node_id).toBe("2");
});

test("workflow should finish with 'end' keyword", async () => {
  let response = await workflow_requests.save(test_wf);
  const wf_id = response.body.workflow_id;
  response = await workflow_requests.createProcess(wf_id, null);
  const process_id = response.body.process_id;
  await process_requests.runProcess(process_id, {});
  await process_requests.runProcess(process_id, end_request);
  response = await process_requests.fetchState(process_id);
  expect(response.body.state.status).toBe("finished");
  expect(response.body.state.node_id).toBe("9");
});

test("workflow should run as many times as it's desired", async () => {
  let response = await workflow_requests.save(test_wf);
  const wf_id = response.body.workflow_id;
  response = await workflow_requests.createProcess(wf_id, null);
  const process_id = response.body.process_id;
  for(let i=0; i<3; i++){
    await process_requests.runProcess(process_id, {});
    await process_requests.runProcess(process_id, continue_request);
    response = await process_requests.fetchState(process_id);
    expect(response.body.state.status).toBe("waiting");
    expect(response.body.state.node_id).toBe("2");
  }
  response = await process_requests.fetchStateHistory(process_id);
  const result = response.body[0].result;
  expect(result.uuids).toHaveLength(continue_request.n_js);
  expect(result.dates).toHaveLength(continue_request.n_interp);
  await process_requests.runProcess(process_id, end_request);
  response = await process_requests.fetchState(process_id);
  expect(response.body.state.status).toBe("finished");
  expect(response.body.state.node_id).toBe("9");
});

const _clean = async () => {
  await db("activity").del();
  await db("activity_manager").del();
  await db("process_state").del();
  await db("process").del();
  await db("workflow").del();
};
