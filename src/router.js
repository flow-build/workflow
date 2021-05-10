const Router = require("koa-router");
const bodyParser = require("koa-bodyparser");
const { captureActorData,
     validateUUID } = require("./middlewares");
const wc = require("./controllers/workflow");
const ac = require("./controllers/activity");
const pc = require("./controllers/process");
const pkc = require("./controllers/package");
const wv = require("./validators/workflow");
const pv = require("./validators/process");
const tc = require("./controllers/token");
const hc = require("./controllers/health-check");
const cors = require('koa2-cors');
const dg = require("./controllers/diagram");

module.exports = (opts = {}) => {
     const router = new Router();

     router.use(bodyParser());
     router.get("/healthcheck", hc.healthCheck);
     router.post("/token", tc.getToken);

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

     router
          .post("/workflows",
               wv.saveWorkflow,
               wc.saveWorkflow)
          .get("/workflows",
               wc.getWorkflowsForActor)
          .get("/workflows/:id",
               validateUUID,
               wc.fetchWorkflow)
          .get("/workflows/name/:name",
               wc.fetchWorkflowByName)
          .get("/workflows/:id/processes",
               validateUUID,
               wc.fetchWorkflowProcessList)
          .delete("/workflows/:id",
               validateUUID,
               wc.deleteWorkflow)
          .post("/workflows/diagram",
               dg.buildDiagram)
          .post("/workflows/:id/create",
               validateUUID,
               wv.createProcess,
               wc.createProcess)
          .post("/workflows/name/:name/create",
               wc.createProcessByName)
          .post("/workflows/name/:workflowName/start",
               wc.createAndRunProcessByName
          )

          .get("/activities/available",
               ac.fetchAvailableActivitiesForActorReduced)
          .get("/processes/activityManager/:id",
               validateUUID,
               ac.fetchActivityByActivityManagerId)
          .get("/processes/available",
               ac.fetchAvailableActivitiesForActor)
          .get("/processes/done",
               ac.fetchDoneActivitiesForActor)
          .get("/processes/:id/activity",
               validateUUID,
               ac.fetchActivity)
          .post("/processes/:process_id/commit",
               validateUUID,
               ac.commitActivity)
          .post("/processes/:process_id/push",
               validateUUID,
               ac.pushActivity)

          .get("/processes/",
               validateUUID,
               pc.fetchProcessList)
          .get("/processes/:id/",
               validateUUID,
               pc.fetchProcess)
          .get("/processes/:id/history",
               validateUUID,
               pc.fetchProcessStateHistory)
          .post("/processes/:id/run",
               validateUUID,
               pv.runProcess,
               pc.runProcess)
          .post("/processes/:id/abort",
               validateUUID,
               pc.abortProcess)
          .post("/packages",
               pkc.savePackage)
          .get("/packages/:id",
               validateUUID,
               pkc.fetchPackage)
          .delete("/packages/:id",
               validateUUID,
               pkc.deletePackage)

          .post("/activity_manager/:activity_manager_id/submit",
               validateUUID,
               ac.submitByActivityManagerId)
          .post("/activity_manager/:activity_manager_id/commit",
               validateUUID,
               ac.commitByActivityManagerId)

     return router;
};
