const _ = require("lodash");
const uuid = require("uuid/v1");
const { setEngine,
  setCockpit } = require("../engine");
const { Engine,
  Cockpit } = require('@flowbuild/engine');
const { db_config, db } = require("./utils/db");
const { startServer } = require("../app");
const { valid_token, actor_data } = require("./utils/samples");
const { workflow_dtos,
  workflowRequests } = require("./utils/workflow_requests");
const { process_dtos,
  processRequests } = require("./utils/process_request");
const { taskRequests } = require("./utils/task_requests");
const { validateTaskWithWorkflow } = require("./utils/auxiliar");

const engine = new Engine("knex", db);
const cockpit = new Cockpit("knex", db);
setEngine(engine);
setCockpit(cockpit);

let server;
let workflow_requests;
let task_requests;
let process_requests;

beforeAll(() => {
  server = startServer(3001);
  const auth_header = ["Authorization", "Bearer " + valid_token];
  workflow_requests = workflowRequests(server, auth_header);
  task_requests = taskRequests(server, auth_header);
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

describe("fetchAvailableActivitiesForActor endpoint should work", () => {
  const num_workflows = 2;
  const num_processes_per_workflow = 1;
  let process_workflow_map;

  beforeEach(async () => {
    const dto = workflow_dtos.start_process;
    const blueprint_spec = workflow_dtos
      .save
      .user_task_workflow
      .blueprint_spec;
    process_workflow_map = await workflow_requests.createManyProcesses(
      dto, blueprint_spec, num_workflows, num_processes_per_workflow);
    const continue_process_dto = process_dtos.continue;
    for (let pair of Object.entries(process_workflow_map)) {
      let process_id = pair[0];
      await process_requests.runProcess(process_id, continue_process_dto);
    }
  });

  test("should return 200", async () => {
    const res = await task_requests.getAvailableForActor();
    expect(res.statusCode).toBe(200);
    const tasks = res.body;
    expect(tasks).toHaveLength(num_workflows * num_processes_per_workflow);
    for (const task of tasks) {
      const workflow = process_workflow_map[task.process_id];
      validateTaskWithWorkflow(task, workflow, "waiting");
    }
  });

  test("should filter by workflow_id accordingly", async () => {
    const workflow_ = _.values(process_workflow_map)[0];
    const filters = { workflow_id: workflow_.id };
    const res = await task_requests.getAvailableForActor(filters);
    expect(res.statusCode).toBe(200);
    const tasks = res.body;
    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    const workflow = process_workflow_map[task.process_id];
    expect(workflow).toMatchObject(workflow_);
    validateTaskWithWorkflow(task, workflow, "waiting");
  });
});

describe("fetchActivityByActivityManagerId endpoint should work", () => {
  const num_workflows = 1;
  const num_processes_per_workflow = 1;
  let process_workflow_map;

  beforeEach(async () => {
    const dto = workflow_dtos.start_process;
    const blueprint_spec = workflow_dtos
      .save
      .user_task_workflow
      .blueprint_spec;
    process_workflow_map = await workflow_requests.createManyProcesses(
      dto, blueprint_spec, num_workflows, num_processes_per_workflow);
    const continue_process_dto = process_dtos.continue;
    for (let pair of Object.entries(process_workflow_map)) {
      let process_id = pair[0];
      await process_requests.runProcess(process_id, continue_process_dto);
    }
  });

  test("should return 200", async () => {
    const activities = await db("activity_manager").select();
    expect(activities).toHaveLength(1);
    const activity_manager_id = activities[0].id;
    const res = await task_requests.getActivityById(activity_manager_id);
    expect(res.body.id).toBeDefined();
  });
});

describe("fetchDoneTasksForActor endpoint should work", () => {
  const num_workflows = 2;
  const num_processes_per_workflow = 2;
  let process_workflow_map;

  beforeEach(async () => {
    const dto = workflow_dtos.start_process;
    const blueprint_spec = workflow_dtos
      .save
      .user_task_workflow
      .blueprint_spec;
    process_workflow_map = await workflow_requests.createManyProcesses(
      dto, blueprint_spec, num_workflows, num_processes_per_workflow);
    const continue_process_dto = process_dtos.continue;
    for (let pair of Object.entries(process_workflow_map)) {
      let process_id = pair[0];
      await process_requests.runProcess(process_id, continue_process_dto);
      await task_requests.commitActivity(process_id, continue_process_dto);
      const push_response = await engine.pushActivity(process_id, actor_data);
      await push_response.processPromise;
    }
  });

  test("should return 200", async () => {
    const res = await task_requests.getDoneForActor();
    expect(res.statusCode).toBe(200);
    const tasks = res.body;
    for (const task of tasks) {
      const workflow = process_workflow_map[task.process_id];
      const node = _.find(workflow.blueprint_spec.nodes, { id: task.node_id });
      const status = node.type === "IdentityUserNativeTask" ? "waiting" : "running";
      validateTaskWithWorkflow(task, workflow, status);
    }
  });

  test("should filter by workflow_id accordingly", async () => {
    const workflow_ = _.values(process_workflow_map)[0];
    const filters = { workflow_id: workflow_.id };
    const res = await task_requests.getDoneForActor(filters);
    expect(res.statusCode).toBe(200);
    const tasks = res.body;
    expect(tasks).toHaveLength(2);
    for (const task of tasks) {
      const workflow = process_workflow_map[task.process_id];
      expect(workflow).toMatchObject(workflow_);
      const node = _.find(workflow.blueprint_spec.nodes, { id: task.node_id });
      const status = node.type === "IdentityUserNativeTask" ? "waiting" : "running";
      validateTaskWithWorkflow(task, workflow, status);
    }
  });
});

describe("fetchActivity endpoint should work", () => {
  const num_workflows = 2;
  const num_processes_per_workflow = 2;
  let process_workflow_map;
  let target_process_id;

  beforeEach(async () => {
    const dto = workflow_dtos.start_process;
    const blueprint_spec = workflow_dtos
      .save
      .user_task_workflow
      .blueprint_spec;
    process_workflow_map = await workflow_requests.createManyProcesses(
      dto, blueprint_spec, num_workflows, num_processes_per_workflow);
    const continue_process_dto = process_dtos.continue;
    for (let pair of Object.entries(process_workflow_map)) {
      let process_id = pair[0];
      target_process_id = process_id;
      await process_requests.runProcess(process_id, continue_process_dto);
    }
  });

  test("should return 200", async () => {
    const res = await task_requests.getActivityForActor(target_process_id);
    expect(res.statusCode).toBe(200);
    const task = res.body;
    const workflow = process_workflow_map[target_process_id];
    const node = _.find(workflow.blueprint_spec.nodes, { id: task.node_id });
    const status = node.type === "IdentityUserNativeTask" ? "waiting" : "running";
    validateTaskWithWorkflow(task, workflow, status);
  });
});

describe("pushActivity endpoint", () => {
  const number_workflows = 1;
  const number_processes_per_workflow = 1;
  let process_workflow_map;
  let target_process_id;
  async function getAndValidateActivityManagers() {
    const activities_response = await task_requests.getAvailableForActor();
    const activities = activities_response.body;
    expect(activities).toHaveLength(1);
    const commit_activity_manager = activities[0];
    expect(commit_activity_manager.node_id).toEqual("2");
    expect(commit_activity_manager.process_status).toEqual("waiting");

    return {
      commit_activity_manager,
    };
  }

  beforeEach(async () => {
    const initial_bag = {};
    const blueprint_spec = workflow_dtos.save.user_task_workflow.blueprint_spec;
    process_workflow_map = await workflow_requests.createManyProcesses(
      initial_bag,
      blueprint_spec,
      number_workflows,
      number_processes_per_workflow
    );
    for (const process_id of Object.keys(process_workflow_map)) {
      target_process_id = process_id;
      await process_requests.runProcess(process_id, {});
    }
  });

  test("pushActivity response", async () => {
    const { commit_activity_manager } = await getAndValidateActivityManagers();

    const push_response = await task_requests.pushActivity(target_process_id);
    expect(push_response.status).toEqual(202);

    let count = 0;
    const max_count = 5;
    let process;
    do {
      const process_response = await process_requests.fetch(target_process_id);
      process = process_response.body;
    } while (count < max_count && process.state.status !== 'finished')
    expect(process.state).toBeDefined();
    expect(process.state.status).toEqual("finished");
  })
})

describe("submitByActivityManagerId endpoint", () => {
  const number_workflows = 1;
  const number_processes_per_workflow = 1;
  let process_workflow_map;
  let target_process_id;
  async function getAndValidateActivityManagers() {
    const activities_response = await task_requests.getAvailableForActor();
    const activities = activities_response.body;
    expect(activities).toHaveLength(2);
    let notify_activity_manager;
    let commit_activity_manager;
    for (const activity_manager of activities) {
      expect(activity_manager.activity_status).toEqual("started");
      expect(activity_manager.process_id).toEqual(target_process_id);
      if (activity_manager.type === "notify") {
        notify_activity_manager = activity_manager;
      } else if (activity_manager.type === "commit") {
        commit_activity_manager = activity_manager;
      }
    }
    expect(notify_activity_manager.node_id).toEqual("2");
    expect(notify_activity_manager.process_status).toEqual("running");

    expect(commit_activity_manager.node_id).toEqual("3");
    expect(commit_activity_manager.process_status).toEqual("waiting");

    return {
      notify_activity_manager,
      commit_activity_manager,
    };
  }

  beforeEach(async () => {
    const initial_bag = {};
    const blueprint_spec = workflow_dtos.save.user_notify_task_workflow.blueprint_spec;
    process_workflow_map = await workflow_requests.createManyProcesses(
      initial_bag,
      blueprint_spec,
      number_workflows,
      number_processes_per_workflow
    );
    for (const process_id of Object.keys(process_workflow_map)) {
      target_process_id = process_id;
      await process_requests.runProcess(process_id, {});
    }
  });

  test("submit notify activity manager", async () => {
    const { notify_activity_manager, commit_activity_manager } = await getAndValidateActivityManagers();

    const submit_response = await task_requests.submitActivity(notify_activity_manager.id, { notifyData: "example" });
    expect(submit_response.status).toEqual(202);

    let fetch_response = await task_requests.getActivityById(notify_activity_manager.id);
    expect(fetch_response.status).toEqual(200);
    let activity_manager = fetch_response.body;
    expect(activity_manager.activity_status).toEqual("completed");
    expect(activity_manager.activities).toHaveLength(1);
    expect(activity_manager.activities[0].data).toEqual({ notifyData: "example" });

    fetch_response = await task_requests.getActivityById(commit_activity_manager.id);
    expect(fetch_response.status).toEqual(200);
    activity_manager = fetch_response.body;
    expect(activity_manager.activity_status).toEqual("started");
    expect(activity_manager.activities).toHaveLength(0);
  });

  test("commit activity manager", async () => {
    const { commit_activity_manager, notify_activity_manager } = await getAndValidateActivityManagers();

    let commit_response = await task_requests.commitActivityByActivityManager(commit_activity_manager.id, { commitData: "first" });
    expect(commit_response.status).toEqual(200);

    let fetch_response = await task_requests.getActivityById(commit_activity_manager.id);
    expect(fetch_response.status).toEqual(200);
    let activity_manager = fetch_response.body;
    expect(activity_manager.activity_status).toEqual("started");
    expect(activity_manager.activities).toHaveLength(1);
    expect(activity_manager.activities[0].data).toEqual({ commitData: "first" });

    commit_response = await task_requests.commitActivityByActivityManager(commit_activity_manager.id, { commitData: "second" });
    expect(commit_response.status).toEqual(200);

    fetch_response = await task_requests.getActivityById(commit_activity_manager.id);
    expect(fetch_response.status).toEqual(200);
    activity_manager = fetch_response.body;
    expect(activity_manager.activity_status).toEqual("started");
    expect(activity_manager.activities).toHaveLength(2);
    // expect(activity_manager.activities[0].data).toEqual({ commitData: "second" });

  });

  test("submit commit activity manager", async () => {
    const { commit_activity_manager, notify_activity_manager } = await getAndValidateActivityManagers();

    const submit_response = await task_requests.submitActivity(commit_activity_manager.id, { commitData: "example" });
    expect(submit_response.status).toEqual(202);

    let fetch_response = await task_requests.getActivityById(commit_activity_manager.id);
    expect(fetch_response.status).toEqual(200);
    let activity_manager = fetch_response.body;
    expect(activity_manager.activity_status).toEqual("completed");
    expect(activity_manager.activities).toHaveLength(1);
    expect(activity_manager.activities[0].data).toEqual({ commitData: "example" });

    fetch_response = await task_requests.getActivityById(notify_activity_manager.id);
    expect(fetch_response.status).toEqual(200);
    activity_manager = fetch_response.body;
    expect(activity_manager.activity_status).toEqual("started");
    expect(activity_manager.activities).toHaveLength(0);

    let count = 0;
    const max_count = 5;
    let process;
    do {
      const process_response = await process_requests.fetch(activity_manager.process_id);
      process = process_response.body;
    } while (count < max_count && process.state.status !== 'finished')
    expect(process.state).toBeDefined();
    expect(process.state.status).toEqual("finished");
  });
});

const _clean = async () => {
  await db("activity").del();
  await db("activity_manager").del();
  await db("process_state").del();
  await db("process").del();
  await db("workflow").del();
};
