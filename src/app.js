const Koa = require("koa");
const router = require("./router");
const cors = require('koa2-cors');
const jwt = require("koa-jwt");
const swagger = require("swagger2");
const { ui } = require("swagger2-koa");

const { setEngine, getEngine, setCockpit, getCockpit } = require("./engine");
const { Engine, Cockpit } = require("@flowbuild/engine");
const { db } = require("./tests/utils/db");

const { jwtSecret } = require("./utils/jwt_secret");

// At execution time, the current folder is the root, that is why src is needed
const swaggerDocument = swagger.loadDocumentSync("src/openapi3.yaml");


const startServer = (port) => {
  let engine = getEngine();
  if (!engine) {
    engine = new Engine("knex", db);
    setEngine(engine);
  }
  let cockpit = getCockpit();
  if (!cockpit) {
    cockpit = new Cockpit("knex", db);
    setCockpit(cockpit);
  }

  const app = new Koa();
  const corsOptions = {
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept']
  }
  app.use(cors(corsOptions));
  app.use(router({
    corsOptions: corsOptions,
    middlewares: [
      jwt({ secret: jwtSecret, debug: true })
    ]
  }).routes());
  app.use(ui(swaggerDocument, "/swagger"))
  return app.listen(port, function () {
    console.log("Server running")
  });
};

module.exports = {
  startServer
};
