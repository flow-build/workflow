const uuid = require("uuid/v1");

const { createJWTToken } = require("../utils/token_generator");
const { jwtSecret } = require("../utils/jwt_secret");

const getToken = (ctx, next) => {
  console.log("[KW] Called getToken");
  const secret = ctx.get("x-secret") || jwtSecret;
  const duration = parseInt(ctx.get("x-duration")) || 3600; // default is 1 hour

  const body = ctx.request.body;
  if (!body.actor_id) {
    body.actor_id = uuid();
  }
  if (!body.claims) {
    body.claims = [];
  }

  const jwtToken = createJWTToken(body, secret, duration);
  ctx.status = 200;
  ctx.body = {
    jwtToken,
    payload: body,
  };
};

module.exports = {
  getToken,
};
