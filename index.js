const router = require("./src/router");
const cockpitRouter = require("./src/cockpit_router");
const { setEngine,
    setCockpit } = require("./src/engine");

module.exports = {
    router,
    cockpitRouter,
    setEngine,
    setCockpit,
};