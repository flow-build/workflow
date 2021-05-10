const { getCockpit, getEngine } = require('../engine');

const fetchAvailableActivitiesForActor = async (ctx, next) => {
	console.log('[KW] Called fetchAvailableActivitiesForActor');

	const cockpit = getCockpit();
	const actor_data = ctx.state.actor_data;
	const query_params = ctx.request.query;
	const workflow_id = query_params.workflow_id;
	const filters = workflow_id ? { workflow_id: query_params.workflow_id } : {};
	let tasks = await cockpit.fetchAvailableActivitiesForActor(actor_data, filters);
	tasks = tasks.map((task) => {
		task.node_name = task.blueprint_spec.nodes.find(e => e.id === task.node_id).name
		delete task.blueprint_spec;
		return task;
	});
	ctx.status = 200;
	ctx.body = tasks;
};

const fetchAvailableActivitiesForActorReduced = async (ctx, next) => {
	console.log('[KW] Called fetchAvailableActivitiesForActor');

	const cockpit = getCockpit();
	const actor_data = ctx.state.actor_data;
	const query_params = ctx.request.query;
	const workflow_id = query_params.workflow_id;
	const filters = workflow_id ? { workflow_id: query_params.workflow_id } : {};
	let tasks = await cockpit.fetchAvailableActivitiesForActor(actor_data, filters);
	tasks = tasks.filter(e => (['finished','interrupted','pending'].indexOf(e.process_status)) < 0).map((task) => {
		let response = {
			activity_manager_id: task.id,
			process_id: task.process_id,
			workflow_id: task.workflow_id,
			created_at: task.created_at,
			type: task.type,
			workflow_name: task.workflow_name,
			process_status: task.process_status,
			node_name: task.blueprint_spec.nodes.find(e => e.id === task.node_id).name,
			action: task.props.action
		}
		return response;
	});
	ctx.status = 200;
	ctx.body = tasks;
};

const fetchDoneActivitiesForActor = async (ctx, next) => {
	console.log('[KW] Called fetchDoneActivitiesForActor');

	const cockpit = getCockpit();
	const actor_data = ctx.state.actor_data;
	const query_params = ctx.request.query;
	const workflow_id = query_params.workflow_id;
	const filters = workflow_id ? { workflow_id: query_params.workflow_id } : {};
	let tasks = await cockpit.fetchDoneActivitiesForActor(actor_data, filters);
	tasks = tasks.map((task) => {
		task.node_name = task.blueprint_spec.nodes.find(e => e.id === task.node_id).name
		delete task.blueprint_spec;
		return task;
	});
	ctx.status = 200;
	ctx.body = tasks;
};

const fetchActivity = async (ctx, next) => {
	console.log('[KW] Called fetchActivity');

	const cockpit = getCockpit();
	const actor_data = ctx.state.actor_data;
	const process_id = ctx.params.id;
	const tasks = await cockpit.fetchAvailableActivityForProcess(process_id, actor_data);
	if (tasks) {
		ctx.status = 200;
		delete tasks.blueprint_spec;
		ctx.body = tasks;
	} else {
		ctx.status = 404;
	}
};

const fetchActivityByActivityManagerId = async (ctx, next) => {
	console.log('[KW] Called fetchActivityByActivityManagerId');

	const engine = getEngine();
	const actor_data = ctx.state.actor_data;
	const activity_manager_id = ctx.params.id;
	const tasks = await engine.fetchActivityManager(activity_manager_id, actor_data);
	if (tasks) {
		ctx.status = 200;
		delete tasks.blueprint_spec;
		ctx.body = tasks;
	} else {
		ctx.status = 404;
	}
};

const commitActivity = async (ctx, next) => {
	console.log('[KW] Called commitActivity');

	const cockpit = getCockpit();
	const actor_data = ctx.state.actor_data;
	const process_id = ctx.params.process_id;
	const external_input = ctx.request.body;
	const tasks = await cockpit.commitActivity(process_id, actor_data, external_input);
	if(tasks.error) {
		switch(tasks.error.errorType) {
			case 'activityManager':
				ctx.status = 404;
				ctx.body = tasks.error;
				break;
			case 'commitActivity':
				ctx.status = 400;
				ctx.body = tasks.error;
				break;
			default:
				ctx.status = 500;
				ctx.body = tasks.error;
				break;
		}		
	} else {
		ctx.status = 200;
		ctx.body = tasks;
	}
};

const pushActivity = async (ctx, next) => {
	console.log('[KW] Called pushActivity');

	const cockpit = getCockpit();
	const actor_data = ctx.state.actor_data;
	const process_id = ctx.params.process_id;
	const response = await cockpit.pushActivity(process_id, actor_data);
	if (response && !response.error) {
		ctx.status = 202;
	} else {
		switch(response.error.errorType) {
			case 'activityManager':
				ctx.status = 404;
				ctx.body = response.error;
				break;
			default:
				ctx.status = 500;
				ctx.body = response.error;
				break;
		}
	}
};

const commitByActivityManagerId = async (ctx, next) => {
	console.log('[KW] Called commitByActivityManagerId');
	const actor_data = ctx.state.actor_data;

	const engine = getEngine();
	const activity_manager_id = ctx.params.activity_manager_id;
	const activity_manager = await engine.fetchActivityManager(activity_manager_id, actor_data);

	//console.log("am:",activity_manager);
	//console.log("process_id:",activity_manager.process_id);

	const cockpit = getCockpit();
	const process_id = activity_manager.process_id;
	const external_input = ctx.request.body;
	const tasks = await cockpit.commitActivity(process_id, actor_data, external_input);
	if(tasks.error) {
		switch(tasks.error.errorType) {
			case 'activityManager':
				ctx.status = 404;
				ctx.body = tasks.error;
				break;
			case 'commitActivity':
				ctx.status = 400;
				ctx.body = tasks.error;
				break;
			default:
				ctx.status = 500;
				ctx.body = tasks.error;
				break;
		}		
	} else {
		ctx.status = 200;
		ctx.body = tasks;
	}
};

const submitByActivityManagerId = async (ctx, next) => {
	console.log('[KW] Called submitByActivityManagerId');

	const engine = getEngine();
	const actor_data = ctx.state.actor_data;
	const activity_manager_id = ctx.params.activity_manager_id;
	const external_input = ctx.request.body;
	const result = await engine.submitActivity(activity_manager_id, actor_data, external_input);
	if (result && !result.error) {
		ctx.status = 202;
	} else {
		switch(result.error.errorType) {
			case 'activityManager':
				ctx.status = 404;
				ctx.body = result.error;
				break;
			case 'commitActivity':
				ctx.status = 400;
				ctx.body = result.error;
				break;
			case 'submitActivity':
				ctx.status = 422;
				ctx.body = result.error;
				break;
			default:
				ctx.status = 500;
				ctx.body = result.error;
				break;
		}	
	}
};

module.exports = {
	fetchAvailableActivitiesForActor,
	fetchAvailableActivitiesForActorReduced,
	fetchDoneActivitiesForActor,
	fetchActivityByActivityManagerId,
	fetchActivity,
	commitActivity,
	pushActivity,
	submitByActivityManagerId,
	commitByActivityManagerId
};
