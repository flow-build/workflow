const _ = require('lodash');
const { getEngine } = require('../engine');

const compare_blueprints = async (workflow_name, blueprint_spec) => {

    const engine = getEngine();
    let result = {};

    try {
		await engine.validateBlueprint(blueprint_spec);
        const current_workflow = await engine.fetchWorkflowByName(workflow_name);
        if(current_workflow) {
			const cur_wf_ordered_nodes = current_workflow.blueprint_spec.nodes.sort((a,b) => { return a.id > b.id ? -1 : 0 });
			const bp_ordered_nodes = blueprint_spec.nodes.sort((a,b) => { return a.id > b.id ? -1 : 0 })
			
			const cur_wf_ordered_lanes = current_workflow.blueprint_spec.lanes.sort((a,b) => { return a.id > b.id ? -1 : 0 });
			const bp_ordered_lanes = blueprint_spec.lanes.sort((a,b) => { return a.id > b.id ? -1 : 0 })
		
			const nodes = _.isEqual(cur_wf_ordered_nodes,bp_ordered_nodes);
			const lanes = _.isEqual(cur_wf_ordered_lanes,bp_ordered_lanes);
			const prepare = _.isEqual(current_workflow.blueprint_spec.prepare,blueprint_spec.prepare);
			const environment = _.isEqual(current_workflow.blueprint_spec.environment,blueprint_spec.environment);
			const requirements = _.isEqual(current_workflow.blueprint_spec.requirements,blueprint_spec.requirements);
		
			if(nodes && lanes && prepare && environment && requirements) {
				result = {
                    changes: false,
					current_workflow: {
						id: current_workflow._id,
						version: current_workflow._version,
					}
				};
			} else {
				result = {
					changes: true,
					current_workflow: {
						id: current_workflow._id,
						version: current_workflow._version,
					},
					comparison: {
						nodes: nodes,
						lanes: lanes,
						prepare: prepare,
						environment: environment,
						requirements: requirements
					}
				};
			}
		} else {
			result = {
                changes: true
            }
		}
		
	} catch (err) {
        result.error = err;
	}

    return result;

}

module.exports = {
    compare_blueprints
}