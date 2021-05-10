const _ = require('lodash');
const { getEngine, getCockpit } = require('../engine');
const { compare_blueprints } = require('../utils/compare_blueprints');

const saveWorkflow = async (ctx, next) => {
	console.log('[KW] Called saveWorkflow');
	const engine = getEngine();
	const { name, description, blueprint_spec } = ctx.request.body;
	try {
		const workflow = await engine.saveWorkflow(name, description, blueprint_spec);
		ctx.status = 201;
		ctx.body = {
			workflow_id: workflow.id,
			workflow_url: `${ctx.header.host}${ctx.url}/${workflow.id}`
		};
	} catch (err) {
		ctx.status = 400;
		ctx.body = { message: `Failed at ${err.message}`, error: err };
	}

	return next();
};

const getWorkflowsForActor = async (ctx, next) => {
	console.log('[KW] Called getWorkflowsForActor');

	const cockpit = getCockpit();
	const actor_data = ctx.state.actor_data;
	const workflows = await cockpit.getWorkflowsForActor(actor_data);
	ctx.status = 200;
	ctx.body = _.map(workflows, (workflow) => {
		const result = workflow;
		delete result.blueprint_spec;
		return result;
	});

	return next();
};

const fetchWorkflow = async (ctx, next) => {
	console.log('[KW] Called fetchWorkflow');

	const engine = getEngine();
	const workflow_id = ctx.params.id;
	const workflow = await engine.fetchWorkflow(workflow_id);
	if (workflow) {
		ctx.status = 200;
		ctx.body = workflow.serialize();
	} else {
		ctx.status = 404;
	}

	return next();
};

const fetchWorkflowByName = async (ctx, next) => {
	console.log('[KW] Called fetchWorkflowByName');

	const engine = getEngine();
	const workflow_name = ctx.params.name;
	const workflow = await await engine.fetchWorkflowByName(workflow_name);
	if (workflow) {
		ctx.status = 200;
		ctx.body = workflow.serialize();
	} else {
		ctx.status = 404;
	}

	return next();
};

const deleteWorkflow = async (ctx, next) => {
	console.log('[KW] Called deleteWorkflow');

	const engine = getEngine();
	const workflow_id = ctx.params.id;
	const num_deleted = await engine.deleteWorkflow(workflow_id);
	if (num_deleted == 0) {
		ctx.status = 404;
	} else {
		ctx.status = 204;
	}

	return next();
};

const fetchWorkflowProcessList = async (ctx, next) => {
	console.log('[KW] Called fetchWorkflowProcessList');

	const cockpit = getCockpit();
	const workflow_id = ctx.params.id;
	const filters = { workflow_id: workflow_id };
	const processes = await cockpit.fetchProcessList(filters);
	ctx.status = 200;
	ctx.body = _.map(processes, (process) => {
		const result = process.serialize();
		delete result.blueprint_spec;
		return result;
	});

	return next();
};

const createProcess = async (ctx, next) => {
	console.log('[KW] Called createProcess');

	const engine = getEngine();
	const workflow_id = ctx.params.id;
	const actor_data = ctx.state.actor_data;
	const input = ctx.request.body;
	const process = await engine.createProcess(workflow_id, actor_data, input);
	if (process) {
		ctx.status = 201;
		ctx.body = {
			process_id: process.id,
			process_url: `${ctx.header.host}${ctx.url}/${process.id}`
		};
	} else {
		ctx.status = 404;
	}

	return next();
};

const createProcessByName = async (ctx, next) => {
	console.log('[KW] Called createProcessByName');

	const engine = getEngine();
	const workflow_name = ctx.params.name;
	const actor_data = ctx.state.actor_data;
	const input = ctx.request.body;
	const process = await engine.createProcessByWorkflowName(workflow_name, actor_data, input);
	if (process) {
		ctx.status = 201;
		ctx.body = {
			process_id: process.id,
			process_url: `${ctx.header.host}${ctx.url.replace("workflows", "processes")}/${process.id}`
		};
	} else {
		ctx.status = 404;
	}

	return next();
};

const createAndRunProcessByName = async (ctx, next) => {
	console.log('[KW] Called createAndRunProcessByName');

	const engine = getEngine();
	const workflow_name = ctx.params.workflowName;
	const actor_data = ctx.state.actor_data;
	const input = ctx.request.body;
	const process = await engine.createProcessByWorkflowName(workflow_name, actor_data, input);
	if (process && process.id) {
		engine.runProcess(process.id, actor_data);
		ctx.status = 201;
		ctx.body = {
			process_id: process.id,
			process_url: `${ctx.header.host}${ctx.url.replace("workflows", "processes")}/${process.id}`
		};
	} else {
		ctx.status = 404;
	}

	return next();

};

const validateBlueprint = async(ctx, next) => {
	console.log('[KW] Called validateBlueprint');

	const engine = getEngine();
	const { blueprint_spec } = ctx.request.body;

	try {
		await engine.validateBlueprint(blueprint_spec);
		ctx.status = 200;
		ctx.body = {
			message: "Blueprint is valid"
		};
	} catch (err) {
		ctx.status = 400;
		ctx.body = { 
			error: 'Invalid blueprint',
			message: `Failed at ${err.message}`
		};
	}

	return next();
}

const compareBlueprint = async(ctx,next) => {
	console.log('[KW] Called compareBlueprint');

	const { name, blueprint_spec } = ctx.request.body;

	try {
		const compare = await compare_blueprints(name, blueprint_spec);
		if(compare.error) {
			ctx.status = 400;
			ctx.body = { 
				error: 'Invalid blueprint',
				message: `Failed at ${compare.error}`
			};
		} else if (compare.changes) {
			if(compare.current_workflow) {
				ctx.status = 202;
				ctx.body = {
					status: "Changes found, check comparison",
					current_workflow: compare.current_workflow,
					comparison: compare.comparison
				};
			} else {
				ctx.status = 404,
				ctx.body = {
					status: "No workflow with this name"
				};
			}
		} else {
			ctx.status = 200,
			ctx.body = {
				status: "No changes found",
				current_workflow: compare.current_workflow,
			};
		}		
	} catch (err) {
		ctx.status = 500;
		ctx.body = { 
			error: err
		};
	}

	return next();
}

module.exports = {
	saveWorkflow,
	getWorkflowsForActor,
	fetchWorkflow,
	fetchWorkflowByName,
	fetchWorkflowProcessList,
	deleteWorkflow,
	createProcess,
	createProcessByName,
	createAndRunProcessByName,
	validateBlueprint,
	compareBlueprint
};
