module.exports = {
    requirements: ["core"],
    prepare: [],
    environment: {},
    lanes: [
        {
            id: "free",
            name: "free for all",
            rule: ["fn", ["&", "args"], true]
        }
    ],
    nodes: [
        {
            id: "1",
            name: "Start parent process",
            type: "Start",
            lane_id: "free",
            next: "2",
            parameters: {
                input_schema: {}
            }
        }, {
            id: "2",
            name: "bag some data",
            type: "systemTask",
            category: "setToBag",
            lane_id: "free",
            next: "3",
            parameters: {
                input: {
                    someData: "some data"
                }
            }
        }, {
            id: "3",
            name: "start subProcess",
            type: "subProcess",
            lane_id: "free",
            next: '4',
            parameters: {
                input: {
                    workflow_name: 'test_subprocess_child',
                    valid_response: 'finished'
                },
                actor_data: { $ref: 'actor_data' }
            }
        }, {
            id: "4",
            name: "bag subprocess data",
            type: "systemTask",
            category: "setToBag",
            lane_id: "free",
            next: "99",
            parameters: {
                input: {
                    subProcessData: { $ref: "result" }
                }
            }
        }, {
            id: "99",
            name: "Finish - parent",
            type: "Finish",
            lane_id: "free",
            next: null
        }
    ]
}