import stream from 'stream';
import Boom from '@hapi/boom';
import { Context } from 'koa';
import { Joi } from 'koa-joi-router';
import bodyParser from 'koa-bodyparser';
import multer from '@koa/multer';
import { Service } from 'typedi';
import axios from 'axios';
import sharp, { Sharp } from 'sharp';
import BaseRouter from '../../common/setup/BaseRouter';
import { schemaToObject } from '../../infra/middlewares/createApiDocumentation';

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

const ALLOWED_FORMATS = ['png', 'jpeg', 'webp'] as const;
type Format = typeof ALLOWED_FORMATS[number] extends keyof Sharp
  ? typeof ALLOWED_FORMATS[number]
  : never;

const checkFormat = (f: any): f is Format => ALLOWED_FORMATS.includes(f);

const UrlsSchema = Joi.array()
  .items(
    Joi.object({
      input: Joi.string().uri().required(),
      output: Joi.string().uri().required(),
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
        kernel: Joi.string().valid(...Object.keys(sharp.kernel)),
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
          const { urls, pipeline } = ctx.request.body;

          const processor = this.createProcessor(pipeline);

          await Promise.all(
            urls.map(
              async ({
                input,
                output,
                format,
              }: {
                input: string;
                output: string;
                format: Format;
              }) => {
                const { data } = await axios({
                  method: 'GET',
                  url: input,
                  responseType: 'stream',
                  timeout: 0,
                });
                const duplex = new stream.PassThrough();
                const upload = axios({
                  method: 'PUT',
                  url: output,
                  data: duplex,
                });

                data.pipe(processor[format]()).pipe(duplex);
                await upload;
              }
            )
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

          const processor = this.createProcessor(procDef, sharp(buffer))[
            format
          ]();

          ctx.body = await processor.toBuffer();
          ctx.status = 200;
        },
      ],
    });
  }

  private createProcessor(
    pipeline: { op: Operation; args: any }[],
    base: Sharp = sharp()
  ): Sharp {
    let proc = base;
    for (const { op, args } of pipeline) {
      proc = proc[op](args);
    }
    return proc;
  }
}