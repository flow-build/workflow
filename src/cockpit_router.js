const Router = require("koa-router");
const bodyParser = require("koa-bodyparser");
const { captureActorData, validateUUID } = require("./middlewares");
const cors = require('koa2-cors');
const cockpit_controller = require("./controllers/cockpit");
const cockpit_validator = require("./validators/cockpit");
const wv = require("./validators/workflow");
const wc = require("./controllers/workflow");

module.exports = (opts = {}) => {
     const router = new Router();

     router.use(bodyParser());

     for (let middleware of opts.middlewares) {
          router.use(middleware);
     }

     router.use(captureActorData);

     router.use(cors(opts.corsOptions));

     if (opts.routes) {
          for (let route of opts.routes) {
               router[route.verb](route.path, ...route.methods);
          }
     }

     router.get("/workflows/stats", cockpit_controller.fetchWorkflowsWithProcessStatusCount);

     router.post("/workflows/validate", wv.saveWorkflow, wc.validateBlueprint);
     router.post("/workflows/compare", wv.saveWorkflow, wc.compareBlueprint);
     router.post("/workflows/update", cockpit_controller.updateDeploy);

     router.post("/processes/:id/state", validateUUID, cockpit_validator.validateSetProcessState, cockpit_controller.setProcessState);
     router.post("/processes/:id/state/run", validateUUID, cockpit_controller.runPendingProcess);

     return router;
};
