const lodash = require("lodash");
const uuid = require("uuid/v1");
const { setEngine, setCockpit } = require("../engine");
const { Engine, Cockpit } = require('@flowbuild/engine');
const { db } = require("./utils/db");
const { startServer } = require("../app");
const { actor_data, valid_token } = require("./utils/samples");
const cockpit_requests = require("./utils/cockpit_requests");
const { workflow_dtos } = require("./utils/workflow_requests");
const { processRequests } = require("./utils/process_request");

const engine = new Engine("knex", db);
const cockpit = new Cockpit("knex", db);
setEngine(engine);
setCockpit(cockpit);

let server;
let process_request;
beforeAll(() => {
    server = startServer(3001);
    cockpit_requests.setServer(server);
    process_request = processRequests(server, ["Authorization", `Bearer ${valid_token}`]);
});

beforeEach(async () => {
    await _cleanDatabase();
});

afterAll(async () => {
    await _cleanDatabase();
    await db.destroy();
    server.close();
});

async function _cleanDatabase() {
    await db("activity").del();
    await db("activity_manager").del();
    await db("process_state").del();
    await db("process").del();
    await db("workflow").del();
};

describe("fetchWorkflowsWithProcessStatusCount", () => {
    test("Base response workflow", async () => {
        const workflow = await engine.saveWorkflow("sample", "sample description", workflow_dtos.save.system_task_workflow.blueprint_spec);

        const response = await cockpit_requests.fetchWorkflowsWithProcessStatusCount();
        expect(response.status).toEqual(200);
        const body = response.body;
        expect(body.workflows).toBeDefined();
        const sample_workflow = body.workflows[workflow.id];
        expect(sample_workflow).toEqual({
            workflow_name: "sample",
            workflow_description: "sample description",
            workflow_version: 1,
        });
    });

    test("Empty workflowws", async () => {
        const response = await cockpit_requests.fetchWorkflowsWithProcessStatusCount();
        expect(response.status).toEqual(200);
        const body = response.body;
        expect(body.workflows).toEqual({});
    });

    test("Workflow id filter", async () => {
        const workflow = await engine.saveWorkflow("sample", "sample description", workflow_dtos.save.system_task_workflow.blueprint_spec);

        let response = await cockpit_requests.fetchWorkflowsWithProcessStatusCount();
        expect(response.status).toEqual(200);
        expect(response.body.workflows).toBeDefined();
        expect(response.body.workflows[workflow.id]).toBeDefined();

        response = await cockpit_requests.fetchWorkflowsWithProcessStatusCount({ workflow_id: uuid() });
        expect(response.status).toEqual(200);
        expect(response.body.workflows).toBeDefined();
        expect(response.body.workflows[workflow.id]).toBeUndefined();
    });

    test("Start_date filter works", async () => {
        const workflow = await engine.saveWorkflow("sample", "sample description", workflow_dtos.save.system_task_workflow.blueprint_spec);

        const start_date = new Date();

        let response = await cockpit_requests.fetchWorkflowsWithProcessStatusCount();
        expect(response.status).toEqual(200);
        expect(response.body.workflows).toBeDefined();
        expect(response.body.workflows[workflow.id]).toBeDefined();

        response = await cockpit_requests.fetchWorkflowsWithProcessStatusCount({ start_date });
        expect(response.status).toEqual(200);
        expect(response.body.workflows).toBeDefined();
        expect(response.body.workflows[workflow.id]).toBeUndefined();
    });

    test("Start_date filter works", async () => {
        const workflow = await engine.saveWorkflow("sample", "sample description", workflow_dtos.save.system_task_workflow.blueprint_spec);

        const start_date = new Date();

        let response = await cockpit_requests.fetchWorkflowsWithProcessStatusCount();
        expect(response.status).toEqual(200);
        expect(response.body.workflows).toBeDefined();
        expect(response.body.workflows[workflow.id]).toBeDefined();

        response = await cockpit_requests.fetchWorkflowsWithProcessStatusCount({ start_date });
        expect(response.status).toEqual(200);
        expect(response.body.workflows).toBeDefined();
        expect(response.body.workflows[workflow.id]).toBeUndefined();
    });
});

describe("setProcessState", () => {
    test("Base response", async () => {
        try {
            const workflow = await engine.saveWorkflow("sample", "sample description", workflow_dtos.save.system_task_workflow.blueprint_spec);
            let process = await engine.createProcess(workflow.id, actor_data);
            const process_id = process.id;
    
            const spy_setProcessState = jest.spyOn(cockpit, "setProcessState");
    
            const state_data = {
                bag: {
                    bagKey: "bagValue",
                },
                result: {
                    resultKey: "resultValue"
                },
                next_node_id: "99",
            };
            const response = await cockpit_requests.setProcessState(process_id, state_data);
            expect(response.status).toEqual(200);
            const body = response.body;
            expect(body.process_id).toEqual(process_id);
            expect(body.status).toEqual("pending");
            expect(body.bag).toEqual({
                bagKey: "bagValue",
            });
            expect(body.result).toEqual({
                resultKey: "resultValue"
            });
            expect(body.next_node_id).toEqual("99");
    
            expect(spy_setProcessState).toHaveBeenCalledTimes(1);
            expect(spy_setProcessState).toHaveBeenNthCalledWith(1, process_id, state_data);
        } finally {
            jest.resetAllMocks();
        }
    });

    test.each([
        {},
        {
            bag: {},
            result: {},
            next_node_id: 99,
        },
        {
            bag: {},
            result: null,
            next_node_id: "99",
        },
        {
            bag: null,
            result: {},
            next_node_id: "99",
        },
        {
            bag: {},
            next_node_id: "99",
        },
        {
            result: {},
            next_node_id: "99",
        },
    ])('request fails with invalid body %o', async (state_data) => {
        try {
            const workflow = await engine.saveWorkflow("sample", "sample description", workflow_dtos.save.system_task_workflow.blueprint_spec);
            let process = await engine.createProcess(workflow.id, actor_data);
            const process_id = process.id;
    
            const spy_setProcessState = jest.spyOn(cockpit, "setProcessState");
    
            const response = await cockpit_requests.setProcessState(process_id, state_data);
            expect(response.status).toEqual(400);
    
            expect(spy_setProcessState).not.toHaveBeenCalled();
        } finally {
            jest.restoreAllMocks();
        }
    });
});

describe("runPendingProcess", () => {
    test("Base response", async () => {
        try {
            const workflow = await engine.saveWorkflow("sample", "sample description", workflow_dtos.save.system_task_workflow.blueprint_spec);
            let process = await engine.createProcess(workflow.id, actor_data);
            const process_id = process.id;
            await cockpit.setProcessState(process_id, {
                bag: {},
                result: {},
                next_node_id: "2",
            });
    
            const spy_runPendingProcess = jest.spyOn(cockpit, "runPendingProcess");
    
            const new_actor = {
                actor_id: 666,
                claims: ["admin"],
            }
            const response = await cockpit_requests.runPendingProcess(process_id, new_actor);
            expect(response.status).toEqual(202);
            const body = response.body;
            expect(body).toEqual({});
    
            let count = 0;
            const max_count = 5;
            do {
                const process_response = await process_request.fetch(process_id);
                process = process_response.body;
            } while (count < max_count && process.state.status !== 'finished')
            expect(process.state).toBeDefined();
            expect(process.state.status).toEqual("finished");
    
            expect(spy_runPendingProcess).toHaveBeenNthCalledWith(1, process_id, new_actor);
        } finally {
            jest.restoreAllMocks();
        }
    });
});