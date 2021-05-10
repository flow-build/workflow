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
const { validateProcess,
        validateProcessState } = require("./utils/auxiliar");

const engine = new Engine("knex", db);
const cockpit = new Cockpit("knex", db);
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

describe("fetchProcess endpoint should work", () => {

  test("should return 200 for existing process", async () => {
    const save_workflow_dto = workflow_dtos.save.system_task_workflow;
    const save_workflow_res = await workflow_requests.save(save_workflow_dto);
    const workflow_id = save_workflow_res.body.workflow_id;

    const start_process_dto = workflow_dtos.start_process;
    const start_process_res = await workflow_requests.createProcess(
      workflow_id, start_process_dto);
    const process_id = start_process_res.body.process_id;

    const res = await process_requests.fetch(process_id);
    expect(res.statusCode).toBe(200);
    const process = res.body;
    const blueprint_spec = save_workflow_dto.blueprint_spec;
    validateProcess(process, workflow_id, blueprint_spec);

    const nodes = save_workflow_dto.blueprint_spec.nodes;
    const state = process.state;
    const first_node = nodes[0];
    const step_number = 1;
    const status = "unstarted";
    validateProcessState(state, process_id, step_number, first_node.id,
                            first_node.id, {}, {}, {}, null, status,
                            actor_data);
  });

  test ("should return 404 for non existing process", async () => {
    const random_id = uuid();
    const res = await process_requests.fetch(random_id);
    expect(res.statusCode).toBe(404);
  });
});

describe("fetchProcessList endpoint should work", () => {
  const num_workflows = 2;
  const num_processes_per_workflow = 2;
  let process_workflow_map;

  beforeEach( async () => {
    const dto = workflow_dtos.start_process;
    const blueprint_spec = workflow_dtos
          .save
          .system_task_workflow
          .blueprint_spec;
    process_workflow_map = await workflow_requests.createManyProcesses(
      dto, blueprint_spec, num_workflows, num_processes_per_workflow);
  });

  test("should return 200", async () => {
    const res = await process_requests.fetchList();
    expect(res.statusCode).toBe(200);

    const processes = res.body;
    expect(processes).toHaveLength(num_workflows *
                                   num_processes_per_workflow);

    for (const process of processes) {
      const process_id = process.id;
      const workflow = process_workflow_map[process_id];
      const workflow_id = workflow.id;
      const blueprint_spec = workflow.blueprint_spec;
      validateProcess(process, workflow_id, blueprint_spec);

      const nodes = blueprint_spec.nodes;
      const state = process.state;
      const first_node = nodes[0];
      const step_number = 1;
      const status = "unstarted";
      validateProcessState(state, process_id, step_number, first_node.id,
                            first_node.id, {}, {}, {}, null, status,
                            actor_data);
    }
  });

  test("should filter by workflow_id accordingly", async () => {
    const workflow_ = _.values(process_workflow_map)[0];
    const workflow_id_ = workflow_.id;
    const filters = { workflow_id: workflow_id_ };
    const res = await process_requests.fetchList(filters);
    expect(res.statusCode).toBe(200);

    const processes = res.body;
    expect(processes).toHaveLength(num_processes_per_workflow);

    for (const process of processes) {
      const process_id = process.id;
      const workflow = process_workflow_map[process_id];
      const workflow_id = workflow.id;
      const blueprint_spec = workflow.blueprint_spec;
      expect(workflow_id).toBe(workflow_id_);
      validateProcess(process, workflow_id, blueprint_spec);

      const nodes = blueprint_spec.nodes;
      const state = process.state;
      const first_node = nodes[0];
      const step_number = 1;
      const status = "unstarted";
      validateProcessState(state, process_id, step_number, first_node.id,
                            first_node.id, {}, {}, {}, null, status,
                            actor_data);
    }
  });
});

describe("fetchProcessStateHistory endpoint should work", () => {

  test("should return 200 for existing process", async () => {
    const save_workflow_dto = workflow_dtos.save.system_task_workflow;
    const save_workflow_res = await workflow_requests.save(save_workflow_dto);
    const workflow_id = save_workflow_res.body.workflow_id;

    const start_process_dto = workflow_dtos.start_process;
    const start_process_res = await workflow_requests.createProcess(
      workflow_id, start_process_dto);
    const process_id = start_process_res.body.process_id;

    const res = await process_requests.fetchStateHistory(process_id);
    expect(res.statusCode).toBe(200);

    const states = res.body;
    const nodes = save_workflow_dto.blueprint_spec.nodes;
    expect(states).toHaveLength(1);

    first_node = nodes[0];
    const step_number = 1;
    const status = "unstarted";
    validateProcessState(states[0], process_id, step_number, first_node.id,
                            first_node.id, {}, {}, {}, null, status);
  });

  test ("should return 404 for non existing process", async () => {
    const random_id = uuid();
    const res = await process_requests.fetchStateHistory(random_id);
    expect(res.statusCode).toBe(404);
  });
});

describe("runProcess endpoint should work", () => {

  test("should return 200 for existing process", async () => {
    const save_workflow_res = await workflow_requests.saveUserTask();
    const workflow_id = save_workflow_res.body.workflow_id;

    const start_process_dto = workflow_dtos.start_process;
    const start_process_res = await workflow_requests.createProcess(
      workflow_id, start_process_dto);
    const process_id = start_process_res.body.process_id;

    let fetch_state_history_res = await process_requests.fetchStateHistory(
      process_id);
    let states = fetch_state_history_res.body;
    expect(states[0].status).toBe("unstarted");

    const continue_process_dto = process_dtos.continue;
    let res = await process_requests.runProcess(process_id,
                                                continue_process_dto);
    expect(res.statusCode).toBe(200);

    fetch_state_history_res = await process_requests.fetchStateHistory(
      process_id);
    states = fetch_state_history_res.body;
    expect(states[0].status).toBe("waiting");

    res = await process_requests.runProcess(process_id,
                                            continue_process_dto);
    expect(res.statusCode).toBe(200);

    fetch_state_history_res = await process_requests.fetchStateHistory(
      process_id);
    states = fetch_state_history_res.body;
    expect(states[0].status).toBe("finished")
  });

  test ("should return 404 for non existing process", async () => {
    const random_id = uuid();
    const dto = process_dtos.continue;
    const res = await process_requests.runProcess(random_id, dto);
    expect(res.statusCode).toBe(404);
  });
});

describe("abortProcess endpoint should work", () => {

  test("should return 200 for existing process", async () => {
    const save_workflow_res = await workflow_requests.saveUserTask();
    const workflow_id = save_workflow_res.body.workflow_id;

    const start_process_dto = workflow_dtos.startProcess;
    const start_process_res = await workflow_requests.createProcess(
      workflow_id, start_process_dto);
    const process_id = start_process_res.body.process_id;

    let fetch_state_history_res = await process_requests.fetchStateHistory(
      process_id);
    let states = fetch_state_history_res.body;
    expect(states[0].status).toBe("unstarted");

    const res = await process_requests.abort(process_id);
    expect(res.statusCode).toBe(200);

    fetch_state_history_res = await process_requests.fetchStateHistory(
      process_id);
    states = fetch_state_history_res.body;
    expect(states[0].status).toBe("interrupted");
  });

  test ("should return 404 for non existing process", async () => {
    const random_id = uuid();
    const res = await process_requests.abort(random_id);
    expect(res.statusCode).toBe(404);
  });
});

describe("runProcess endpoint should work", () => {

  test("should return 200 for existing process", async () => {
    const save_workflow_res = await workflow_requests.saveUserTask();
    const workflow_id = save_workflow_res.body.workflow_id;

    const start_process_dto = workflow_dtos.startProcess;
    const start_process_res = await workflow_requests.createProcess(
      workflow_id, start_process_dto);
    const process_id = start_process_res.body.process_id;

    let fetch_state_history_res = await process_requests.fetchStateHistory(
      process_id);
    let states = fetch_state_history_res.body;
    expect(states[0].status).toBe("unstarted");

    const continue_process_dto = process_dtos.continue;
    const res = await process_requests.runProcess(process_id,
                                                  continue_process_dto);
    expect(res.statusCode).toBe(200);

    fetch_state_history_res = await process_requests.fetchStateHistory(
      process_id);
    states = fetch_state_history_res.body;
    expect(states[0].status).toBe("waiting");
  });

  test ("should return 404 for non existing process", async () => {
    const random_id = uuid();
    const dto = process_dtos.continue;
    const res = await process_requests.runProcess(random_id, dto);
    expect(res.statusCode).toBe(404);
  });
});

describe('Workflow with requirements and prepare works', () => {

  test("Workflow should run with valid packages", async () => {
    const save_workflow_res = await workflow_requests.saveUserScriptTask();
    const workflow_id = save_workflow_res.body.workflow_id;

    const start_process_dto = workflow_dtos.startProcess;
    const start_process_res = await workflow_requests.createProcess(
      workflow_id, start_process_dto);

    const process_id = start_process_res.body.process_id;
    const dto = process_dtos.continue;
    await process_requests.runProcess(process_id, dto);

    let process_res = await process_requests.fetch(process_id);
    expect(process_res.body.state.status).toStrictEqual("waiting");
    const continue_process_res = await process_requests.runProcess(
      process_id, {any: "any"});
    process_res = await process_requests.fetch(process_id);
    expect(process_res.body.state.bag).toStrictEqual({any: "any"});
  });
});

const _clean = async () => {
  await db("activity").del();
  await db("activity_manager").del();
  await db("process_state").del();
  await db("process").del();
  await db("workflow").del();
};
