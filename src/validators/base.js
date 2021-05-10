var Ajv = require("ajv");
const ajv = new Ajv();

const validateBodyWithSchema = (schema) => {
  return async (ctx, next) => {
    const is_valid = await ajv.validate(schema, ctx.request.body);
    if (!is_valid) {
      ctx.throw(400, "Invalid request payload.");
    };
    return await next();
  };
};

module.exports = {
  validateBodyWithSchema: validateBodyWithSchema
};
