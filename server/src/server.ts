import 'reflect-metadata';
import Koa from 'koa';
import config from './common/setup/config';
import log from './common/setup/log';
import errorHandlerMiddleware from './infra/middlewares/errorHandlerMiddleware';
import requestLoggerMiddleware from './infra/middlewares/requestLoggerMiddleware';
import restMiddlewares from './rest';
import { initFunctionHandler } from './function';

// Koa
const server = new Koa();

// Request state prototype
server.use(async (ctx, next) => {
  ctx.state = ctx.state || {};
  ctx.state.log = log;
  await next();
});

// Middlewares
server.use(requestLoggerMiddleware); // Assume no errors in logging
server.use(errorHandlerMiddleware);

// REST API routing
restMiddlewares.forEach((middleware) => {
  server.use(middleware);
});

// Start the server or function handler
let handler = null;
if (config.RUN_AS_FUNCTION) {
  handler = initFunctionHandler(server, config.BASE_PATH);
  log.info('Function started');
} else {
  server.listen(config.API_PORT, config.API_BINDADDR, () => {
    log.info(
      {
        name: config.APP_NAME,
        address: config.API_BINDADDR,
        port: config.API_PORT,
      },
      'Server started'
    );
  });
}

export { server, handler };
