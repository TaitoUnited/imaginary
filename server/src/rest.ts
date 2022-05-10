import { Context } from 'koa';
import router from 'koa-joi-router';
import { Container } from 'typedi';

import config from './common/setup/config';
import createApiDocumentation from './infra/middlewares/createApiDocumentation';
import InfraRouter from './infra/routers/InfraRouter';
import { ImageProcessingRouter } from './core/routers/ImageProcessorRouter';

// REST API routers
const procRouter = Container.get(ImageProcessingRouter);
const infraRouter = Container.get(InfraRouter);
const apiDocRouter = router();

apiDocRouter.route({
  method: 'get',
  path: '/docs',
  handler: async (ctx: Context) => {
    ctx.response.body = createApiDocumentation({
      title: config.APP_NAME,
      groups: [procRouter, infraRouter].map((r) => ({
        name: r.group,
        routes: r.routes,
        prefix: r.prefix,
      })),
    });
  },
});

const restMiddlewares = [
  procRouter.middleware(),
  infraRouter.middleware(),
  apiDocRouter.middleware(),
];

export default restMiddlewares;
