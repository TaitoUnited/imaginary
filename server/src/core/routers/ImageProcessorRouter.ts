import stream from 'stream';
import Boom, { boomify } from '@hapi/boom';
import { Context } from 'koa';
import { Joi } from 'koa-joi-router';
import bodyParser from 'koa-bodyparser';
import multer from '@koa/multer';
import { Service } from 'typedi';
import axios, { AxiosPromise } from 'axios';
import sharp, { ResizeOptions, Sharp } from 'sharp';
import BaseRouter from '../../common/setup/BaseRouter';
import { schemaToObject } from '../../infra/middlewares/createApiDocumentation';
import { replaceVariables } from '../../common/utils/format';

const ALLOWED_OPERATIONS = [
  'resize',
  'rotate',
  'flip',
  'flop',
  'blur',
] as const;
type Operation = typeof ALLOWED_OPERATIONS[number] extends keyof Sharp
  ? typeof ALLOWED_OPERATIONS[number]
  : never;

const HTTP_METHODS = ['PUT', 'POST'] as const;
type HttpMethod = typeof HTTP_METHODS[number];

const ALLOWED_FORMATS = ['png', 'jpeg', 'webp'] as const;
type Format = typeof ALLOWED_FORMATS[number] extends keyof Sharp
  ? typeof ALLOWED_FORMATS[number]
  : never;

const checkFormat = (f: any): f is Format => ALLOWED_FORMATS.includes(f);

export type Urls = {
  input: string;
  output:
    | string
    | {
        url: string;
        headers: {
          [key: string]: string;
        };
        method: HttpMethod;
      };
  format: Format;
}[];

const UrlsSchema = Joi.array()
  .items(
    Joi.object({
      input: Joi.string().uri().required(),
      output: Joi.alternatives(
        Joi.string().uri().required(),
        Joi.object({
          url: Joi.string().uri().required(),
          headers: Joi.object().pattern(Joi.string(), Joi.string()),
          method: Joi.string()
            .valid(...HTTP_METHODS)
            .default('PUT'),
        })
      ),
      format: Joi.string()
        .valid(...ALLOWED_FORMATS)
        .default('webp'),
    })
  )
  .min(1);

const OperationSchema = (op: Operation) => {
  let argsSchema: any;
  switch (op) {
    case 'resize': {
      argsSchema = Joi.object({
        width: Joi.number(),
        height: Joi.number(),
        fit: Joi.string().valid(...Object.keys(sharp.fit)),
        kernel: Joi.string().valid(...Object.keys(sharp.kernel)),
        maxWidth: Joi.number(),
        maxHeight: Joi.number(),
      });
      break;
    }
    case 'blur': {
      argsSchema = Joi.number().min(0.3).max(1000);
      break;
    }
    case 'rotate': {
      argsSchema = Joi.number().required();
      break;
    }
  }
  if (argsSchema) {
    return Joi.object({
      op: Joi.string().valid(op).required(),
      args: argsSchema.required(),
    });
  }
  return Joi.object({ op: Joi.string().valid(op).required() });
};

const PipelineSchema = Joi.array()
  .items(...ALLOWED_OPERATIONS.map((op) => OperationSchema(op)))
  .min(1);

@Service()
export class ImageProcessingRouter extends BaseRouter {
  constructor(router: any = null) {
    super(router);
    this.group = 'Image Processing';
    this.prefix = '/convert';
    this.setupRoutes();
  }

  private setupRoutes() {
    this.route({
      method: 'POST',
      path: '/urls',
      documentation: {
        description: 'Process images from url',
      },
      validate: {
        type: 'json',
        body: this.Joi.object({
          pipeline: PipelineSchema.required(),
          urls: UrlsSchema.required(),
        }).required(),
      },
      handler: [
        bodyParser(),
        async (ctx: Context) => {
          const { urls, pipeline } = ctx.request.body as {
            urls: Urls;
            pipeline: any;
          };

          await Promise.all(
            urls.map(async ({ input, output, format }, index) => {
              let data: any;

              try {
                const res = await axios({
                  method: 'GET',
                  url: input,
                  timeout: 0,
                  responseType: 'arraybuffer',
                });

                data = res.data;
              } catch (e) {
                if (axios.isAxiosError(e) && e.response) {
                  // throw HTTP error with the same status code from the target
                  // not sure what the convention would be in these cases but this kinda makes sense, right?
                  throw boomify(e, {
                    statusCode: e.response.status,
                    message: `Error fetching image from url[${index}] ${input}: ${e.response?.data}`,
                  });
                }

                throw e;
              }

              const outputUrl =
                typeof output === 'string' ? output : output.url;
              const outputHeaders =
                typeof output === 'string' ? {} : output.headers;
              const uploadMethod =
                typeof output === 'string' ? 'PUT' : output.method;

              const processor = (
                await this.createProcessor(pipeline, sharp(data))
              )[format]();
              const outputBuffer = await processor.toBuffer();

              const outputVariables = {
                OUTPUT_LENGTH: outputBuffer.length,
              };

              try {
                await axios({
                  method: uploadMethod,
                  url: outputUrl,
                  headers: {
                    ...Object.keys(outputHeaders ?? {}).reduce(
                      (obj, key) => ({
                        ...obj,
                        [key]: replaceVariables(
                          outputHeaders[key],
                          outputVariables
                        ),
                      }),
                      {} as Record<string, any>
                    ),
                  },
                  data: outputBuffer,
                });
              } catch (e) {
                if (axios.isAxiosError(e) && e.response) {
                  throw boomify(e, {
                    statusCode: e.response.status,
                    message: `Error uploading image to url[${index}] ${outputUrl}: ${JSON.stringify(
                      e.response?.data
                    )}`,
                  });
                }

                throw e;
              }
            })
          );

          ctx.status = 200;
        },
      ],
    });

    this.route({
      method: 'POST',
      path: '/image',
      documentation: {
        description: 'Convert image from request and return in response.',
        inputs: [
          {
            key: 'pipeline',
            value: JSON.stringify(
              schemaToObject(PipelineSchema.describe()),
              null,
              2
            ),
          },
          {
            key: 'format',
            value: ALLOWED_FORMATS.map((f) => `'${f}'`).join(' | '),
          },
          { key: 'image', value: 'image upload' },
        ],
        outputs: {
          '200': { body: 'processed image byte content' },
        },
      },
      handler: [
        multer().fields([
          { name: 'pipeline', maxCount: 1 },
          { name: 'format', maxCount: 1 },
          { name: 'image', maxCount: 1 },
        ]),
        async (ctx: Context) => {
          if (!('image' in (ctx.request.files || {})))
            throw Boom.badRequest('image missing');
          if (!('pipeline' in ctx.request.body))
            throw Boom.badRequest('pipeline missing');
          if (!('format' in ctx.request.body))
            throw Boom.badRequest('format missing');

          const { pipeline, format } = ctx.request.body;
          const {
            image: [{ buffer }],
          } = ctx.request.files as any;

          if (!checkFormat(format)) throw Boom.badRequest('invalid format');
          const { value: procDef, error } = PipelineSchema.validate(
            JSON.parse(pipeline)
          );
          if (error) throw Boom.badRequest(`invalid pipeline: ${error}`);

          const processor = (
            await this.createProcessor(procDef, sharp(buffer))
          )[format]();

          ctx.body = await processor.toBuffer();
          ctx.status = 200;
        },
      ],
    });
  }

  private async createProcessor(
    pipeline: { op: Operation; args: any }[],
    base: Sharp = sharp()
  ): Promise<Sharp> {
    let proc = base;
    for (const { op, args } of pipeline) {
      if (op === 'resize') {
        const metadata = await proc.metadata();
        const { width = 0, height = 0 } = metadata;

        const aspect = width / height;
        const keepAspect = args.fit === 'contain';

        const resizedWidth = args.maxWidth
          ? Math.min(args.maxWidth, width)
          : args.width;
        const resizedHeight = args.maxHeight
          ? Math.min(args.maxHeight, height)
          : args.height;

        const resizeOptions: ResizeOptions = {
          background: { r: 255, g: 255, b: 255, alpha: 1 },
          ...args,
          width:
            keepAspect && width < height
              ? Math.round(aspect * resizedHeight)
              : Math.round(resizedWidth),
          height:
            keepAspect && height < width
              ? Math.round(resizedWidth / aspect)
              : Math.round(resizedHeight),
        };

        proc = proc.resize(resizeOptions);
      } else {
        proc = proc[op](args);
      }
    }
    return proc;
  }
}
