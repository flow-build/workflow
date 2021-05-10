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
const { process_dtos,
        processRequests} = require("./utils/process_request");
const { validateWorkflow,
        validateProcess,
        validateProcessState } = require("./utils/auxiliar");
const extra_nodes = require('./utils/extra_nodes');

const engine = new Engine("knex", db);
engine.addCustomSystemCategory(extra_nodes);
const cockpit = new Cockpit("knex", db);
cockpit.addCustomSystemCategory(extra_nodes);
setEngine(engine);
setCockpit(cockpit);

let server;
let workflow_requests;
let process_requests;

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

test("Validation of workflow with custom node works", async () => {
  const res = await workflow_requests.saveCustomTask();
  expect(res.statusCode).toBe(201);
  const workflow = res.body;
  expect(workflow.workflow_id).toBeDefined();
  expect(workflow.workflow_url).toBeDefined();
});

test("createProcess with custom node works", async () => {
  const save_res = await workflow_requests.saveCustomTask();
  const workflow_id = save_res.body.workflow_id;
  const start_res = await workflow_requests.createProcess(workflow_id,
                                                          workflow_dtos.start_process);
  expect(start_res.statusCode).toBe(201);
  const process = start_res.body;
  expect(process.process_id).toBeDefined();
  expect(process.process_url).toBeDefined();
});

test("runProcess with custom node works", async () => {
  const save_workflow_res = await workflow_requests.saveCustomTask();
  const workflow_id = save_workflow_res.body.workflow_id;

  const start_process_dto = workflow_dtos.startProcess;
  const start_process_res = await workflow_requests.createProcess(
    workflow_id, start_process_dto);
  const process_id = start_process_res.body.process_id;

  let fetch_state_history_res = await process_requests.fetchStateHistory(
    process_id);
  let states = fetch_state_history_res.body;
  expect(states[0].status).toBe("unstarted");

  const dto = process_dtos.continue;
  const res = await process_requests.runProcess(process_id, dto);
  expect(res.statusCode).toBe(200);

  fetch_state_history_res = await process_requests.fetchStateHistory(
    process_id);
  states = fetch_state_history_res.body;
  expect(states[0].status).toBe("waiting");
});

const _clean = async () => {
  await db("activity").del();
  await db("activity_manager").del();
  await db("process_state").del();
  await db("process").del();
  await db("workflow").del();
};
