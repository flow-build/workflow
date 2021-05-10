const { getEngine } = require('../engine');
const buildXmlDiagram = require('@flowbuild/nodejs-diagram-builder');

const buildDiagram = async (ctx, next) => {
	console.log('[KW] Called buildDiagram');
	const engine = getEngine();
	let { workflow_id, blueprint_spec, name } = ctx.request.body;
	
    let diagram;
	
	if(workflow_id) {
		const workflow = await engine.fetchWorkflow(workflow_id);
		blueprint_spec = workflow.blueprint_spec;
		name = workflow.name;
	}
    
	try {
		diagram = await buildXmlDiagram(blueprint_spec, name)
		ctx.status = 200;
		ctx.body = diagram;
	} catch (err) {
		ctx.status = 400;
		ctx.body = { message: `Failed at ${err.message}`, error: err };
	}

	return next();
};

module.exports = {
	buildDiagram
}