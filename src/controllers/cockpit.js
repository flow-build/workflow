const { getCockpit, getEngine } = require('../engine');
const fs = require('fs');
const simpleGit = require('simple-git');
const { exception } = require('console');
const wc = require('./workflow');
const { compare_blueprints } = require('../utils/compare_blueprints');

module.exports.fetchWorkflowsWithProcessStatusCount = async (ctx, next) => {
	console.log('[KW] Called fetchWorkflowsWithProcessStatusCount');
	const cockpit = getCockpit();
	const filters = ctx.query;

	const workflows = await cockpit.fetchWorkflowsWithProcessStatusCount(filters);
	ctx.status = 200;
	ctx.body = {
		workflows
	};
};

module.exports.setProcessState = async (ctx, next) => {
	console.log('[KW] Called setProcessState');

	const cockpit = getCockpit();
	const process_id = ctx.params.id;
	const state_data = ctx.request.body;
	const result = await cockpit.setProcessState(process_id, state_data);
	ctx.status = 200;
	ctx.body = result.serialize();
};

module.exports.runPendingProcess = async (ctx, next) => {
	console.log('[KW] Called runPendingProcess');

	const cockpit = getCockpit();
	const process_id = ctx.params.id;
	const actor_data = ctx.request.body;

	const result = await cockpit.runPendingProcess(process_id, actor_data);
	ctx.status = 202;
};

module.exports.updateDeploy = async (ctx, next) => {
	console.log('[KW] Called updateDeploy');

	const USER = ctx.request.body.user || process.env.GIT_USER;
	const PASS = ctx.request.body.password || process.env.GIT_PASSWORD;
	const REPO = ctx.request.body.repo || process.env.GIT_REPO;
	const config = ctx.request.body.config;

	const remote = `https://${USER}:${PASS}@${REPO}`;

	// if(!process.env.BLUEPRINT_REPO_PATH){
	// 	throw Error("BLUEPRINT_REPO_PATH not set!")
	// }
	
	const baseDir = './tmp';
	const options = {
		baseDir,
		binary: 'git',
		maxConcurrentProcesses: 6,
	};

	fs.rmdirSync(baseDir, { recursive: true });

	if(!fs.existsSync(baseDir)){
		fs.mkdirSync(baseDir);
	}

	const git = simpleGit(options);

	let clone;
	// let pull;
	try{
		// pull = await git.pull();
		console.log('Update Blueprints >>> STEP 1 Cloning Repo');
		clone = await git.clone(remote);
	}catch(err){
		console.error('Update Blueprints >>> STEP 1 ', err);
		ctx.status = 401,
		ctx.body = {
			err,
			status: "Failed at git connection"
		};
		return next();
	}

	// if(pull.summary.changes===0){
	// 	console.log('No changes found! Returning 304 from updateDeploy');
	// 	ctx.status = 304; // not modified
	// 	return next();
	// }

	const repo_name = fs.readdirSync(baseDir)[0];
	const repo_dir = `${baseDir}/${repo_name}`
	const changed_files = fs.readdirSync(repo_dir);
	// const changed_files = pull.files.filter(file => !pull.deleted.includes(file));
	// console.log('Updating files ', changed_files);

	const engine = getEngine();

	const blueprints = changed_files.reduce((acc, file) => {
		const dot_file = file.split('.');
		if(dot_file[dot_file.length - 1]!=='json'){
			return acc;
		}
		const parsed_json = JSON.parse(fs.readFileSync(`${repo_dir}/${file}`));
		if(!parsed_json.blueprint_spec){
			return acc;
		}
		acc.push(parsed_json);
		return acc;
	}, []);

	console.log(`Update Blueprints >>> STEP 1 Identified ${blueprints.length} blueprints`);
	//console.log('blueprints:', blueprints)

	const validation_promises = blueprints.map(async (blueprint) => {
		let valid;
		let message;

		try{
			await engine.validateBlueprint(blueprint.blueprint_spec);
			valid = true;
		}catch(e){
			valid = false;
			message = e.message;
		}
		return { 
			valid: valid,
			message: message,
			workflow_name: blueprint.name 
		}
	})

	console.log('Update Blueprints >>> STEP 2 Validating Blueprints');
	const validations = await Promise.all(validation_promises);
	const failed = validations.reduce((acc, cur) => !cur.valid ? acc+1 : acc, 0);

	if(failed > 0) {
		console.error(`Update Blueprints >>> STEP 2 ${failed} blueprints failed validation`);
	}
	
	console.log('Update Blueprints >>> STEP 3 Comparing blueprints with database');
	const change_promises = validations.filter((i) => i.valid).map( async (validation) => {
		let comparison;
		let blueprint_spec = blueprints.find((e) => e.name === validation.workflow_name).blueprint_spec;

		comparison = await compare_blueprints(validation.workflow_name, blueprint_spec);
		if (comparison.changes) {
			if(comparison.current_workflow) {
				return {
					workflow_name: validation.workflow_name,
					changed: true,
					action: 'update',
					current_id: comparison.current_workflow.id,
					current_version: comparison.current_workflow.version
				}
			} else {
				return {
					workflow_name: validation.workflow_name,
					changed: true,
					action: 'insert',
					current_id: '',
					current_version: 0
				}
			}
		} else {
			return {
				workflow_name: validation.workflow_name,
				changed: false,
				action: 'none',
				current_id: comparison.current_workflow.id,
				current_version: comparison.current_workflow.version
			}
		}
	})

	const comparisons = await Promise.all(change_promises);
	const changes = comparisons.reduce((acc, cur) => cur.action ? acc+1 : acc, 0);
	
	console.log(`Update Blueprints >>> STEP 3 ${changes} modifications found`);
	
	if(config && config.onError === 'continue' && failed > 0) {
	
		console.log('Update Blueprints >>> STEP 4 Updating only valid blueprints');
	
		const publish_promises = comparisons.filter((c) => c.changed)
			.map(async i => {
				let blueprint = blueprints.find((bp) => bp.name === i.workflow_name);
				return engine.saveWorkflow(blueprint.name, blueprint.description, blueprint.blueprint_spec)
			});
		const publishes = await Promise.all(publish_promises);

		ctx.status = 200;
		ctx.body = {
			published: publishes.map((e) => (
				{
					workflow_name: e._name,
					workflow_id: e._id,
					current_version: comparisons.find((i) => i.workflow_name === e._name).current_version + 1,
					action: comparisons.find((i) => i.workflow_name === e._name).action
				}
			)),
			unpublished: comparisons.filter((i) => !i.changed).map((e) => (
				{
					workflow_name: e.workflow_name,
					workflow_id: e.current_id,
					current_version: e.current_version,
				}
			)),
			errors: validations.filter((i) => !i.valid).map((bp) => (
				{
				workflow_name: bp.workflow_name,
				message: bp.message
				}
			))
		}
	} else if(failed > 0) {
		ctx.status = 417; // expectation failed
		ctx.body = {
			errors: validations.filter((i) => !i.valid).map((bp) => ({
				workflow_name: bp.workflow_name,
				message: bp.message
				})
			)}
	} else {
		console.log('Update Blueprints >>> STEP 4 Updating all blueprints');
		const saves = blueprints.map(async blueprint => {
			return engine.saveWorkflow(blueprint.name, blueprint.description, blueprint.blueprint_spec)
		});

		const publishes = await Promise.all(saves);

		ctx.status = 202; // accepted
		ctx.body = {
			published: publishes.map((e) => (
				{
					workflow_name: e._name,
					workflow_id: e._id,
					current_version: comparisons.find((i) => i.workflow_name === e._name).current_version + 1,
					action: comparisons.find((i) => i.workflow_name === e._name).action
				}
			))
		}
	}

	fs.rmdirSync(repo_dir, { recursive: true });
	return next();

};
