import Koa from 'koa';

export const initFunctionHandler = (server: Koa, basePath: string) => {
  const handler = async (event: any, context: any) => {
    if (event.source === 'aws.events') {
      throw new Error(`Unknown event: ${event.resources[0]}`);
    } else {
      // Http request
    }
  };

  return handler;
};
