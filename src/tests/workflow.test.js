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
const { validateWorkflow,
        validateProcess,
        validateProcessState } = require("./utils/auxiliar");

const engine = new Engine("knex", db);
const cockpit = new Cockpit("knex", db);
setEngine(engine);
setCockpit(cockpit);

let server;
let requests;

beforeAll(() => {
  server = startServer(3001);
  const auth_header = ["Authorization", "Bearer " + valid_token];
  requests = workflowRequests(server, auth_header);
});

beforeEach(async () => {
  await _clean();
});

afterAll(async () => {
  await _clean();
  await db.destroy();
  server.close();
});

describe("saveWorkflow endpoint should work", () => {
  test("should return 201 for valid input", async () => {
    const res = await requests.saveSystemTask();
    expect(res.statusCode).toBe(201);
    const workflow = res.body;
    expect(workflow.workflow_id).toBeDefined();
    expect(workflow.workflow_url).toBeDefined();
  });

  test("should return 201 for repeated input", async () => {
    let res = await requests.saveSystemTask();
    expect(res.statusCode).toBe(201);
    let workflow = res.body;
    expect(workflow.workflow_id).toBeDefined();
    expect(workflow.workflow_url).toBeDefined();
    res = await requests.saveSystemTask();
    expect(res.statusCode).toBe(201);
    workflow = res.body;
    expect(workflow.workflow_id).toBeDefined();
    expect(workflow.workflow_url).toBeDefined();
  });

  test("should return 400 for invalid requests", async () => {
    const dto = workflow_dtos.save.system_task_workflow;
    const required_fields = _.keys(dto);
    for (const field of required_fields) {
      const dto_ = { ...dto};
      delete dto_[field];
      const res = await requests.save(dto_);
      expect(res.statusCode).toBe(400);
    }
    const dto_ = { ...dto, x: "y" };
    const res = await requests.save(dto_);
    expect(res.statusCode).toBe(400);
  });
});

describe("fetchWorkflowsForActor endpoint should work", () => {
  const num_workflows = 5;
  let workflows;

  beforeEach(async () => {
    const dto = workflow_dtos.save.system_task_workflow;
    const blueprint_spec = dto.blueprint_spec;
    workflows = await requests.saveMany(blueprint_spec, num_workflows);
  });

  test("should return 200", async () => {
    const res = await requests.fetchForActor();
    expect(res.statusCode).toBe(200);
    const workflows_ = res.body;
    expect(workflows).toHaveLength(num_workflows);
    for (const workflow of workflows) {
      const workflow_ = _.find(workflows_, { id: workflow.id });
      // validateWorkflow(workflow, workflow_);
    }
  });
});

describe("fetchWorkflow endpoint should work", () => {
  let workflow;

  beforeEach(async () => {
    const dto = workflow_dtos.save.system_task_workflow;
    const blueprint_spec = dto.blueprint_spec;
    workflow = (await requests.saveMany(blueprint_spec, 1))[0];
  });

  test("should return 200 for existing workflow", async () => {
    const res = await requests.fetch(workflow.id);
    expect(res.statusCode).toBe(200);
    const workflow_ = res.body;
    validateWorkflow(workflow, workflow_);
    ;
  });

  test("should return 404 for non existing workflow", async () => {
    const random_id = uuid();
    const res = await requests.fetch(random_id);
    expect(res.statusCode).toBe(404);
  });

  test("should return 404 for invalid workflow id", async () => {
    const random_id = 'invalid';
    const res = await requests.fetch(random_id);
    expect(res.statusCode).toBe(404);
  });
});

describe("deleteWorkflow endpoint should work", () => {

  test("should return 204 for existing workflow", async () => {
    const save_res = await requests.saveSystemTask();
    const workflow_id = save_res.body.workflow_id;
    const del_res = await requests.delete(workflow_id);
    expect(del_res.statusCode).toBe(204);
  });

  test("should return 404 for non existing workflow", async () => {
    const random_id = uuid();
    const res = await requests.delete(random_id);
    expect(res.statusCode).toBe(404);
  });
});

describe("createProcess endpoint should work", () => {

  test("should return 201 for existing workflow", async () => {
    const save_res = await requests.saveSystemTask();
    const workflow_id = save_res.body.workflow_id;
    const start_res = await requests.createProcess(workflow_id,
                                                   workflow_dtos.start_process);
    expect(start_res.statusCode).toBe(201);
    const process = start_res.body;
    expect(process.process_id).toBeDefined();
    expect(process.process_url).toBeDefined();
  });

  test("should return 404 for non existing workflow", async () => {
    const random_id = uuid();
    const res = await requests.createProcess(random_id,
                                            workflow_dtos.start_process);
    expect(res.statusCode).toBe(404);
  });
});

describe("createProcessByWorkflowName endpoint should work", () => {

  test("should return 201 for existing workflow", async () => {
    const save_res = await requests.saveSystemTask();
    const workflow_name = workflow_dtos.save.system_task_workflow.name;
    const start_res = await requests.createProcessByWorkflowName(workflow_name,
                                                   workflow_dtos.start_process);
    expect(start_res.statusCode).toBe(201);
    const process = start_res.body;
    expect(process.process_id).toBeDefined();
    expect(process.process_url).toBeDefined();
  });
});

describe("fetchWorkflowProcessList endpoint should work", () => {
  const num_workflows = 2;
  const num_processes_per_workflow = 2;
  let process_workflow_map;

  beforeEach( async () => {
    const dto = workflow_dtos.start_process;
    const blueprint_spec = workflow_dtos
          .save
          .system_task_workflow
          .blueprint_spec;
    process_workflow_map = await requests.createManyProcesses(
      dto, blueprint_spec, num_workflows, num_processes_per_workflow);
  });

  test("should return 200", async () => {
    const workflow_id_ = _.values(process_workflow_map)[0].id;

    const res = await requests.fetchProcessList(workflow_id_);
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
                            first_node.id, {}, {}, {}, null, status);
    }
  });
});

const _clean = async () => {
  await db("activity").del();
  await db("activity_manager").del();
  await db("process_state").del();
  await db("process").del();
  await db("workflow").del();
};
