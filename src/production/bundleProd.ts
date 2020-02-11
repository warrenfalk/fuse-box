import { IRunResponse } from '../core/IRunResponse';
import { Context } from '../core/context';
import { createProductionContext } from './ProductionContext';
import { Engine } from './engine';

export async function bundleProd(ctx: Context): Promise<IRunResponse> {
  ctx.log.startStreaming();
  const context = createProductionContext(ctx);
  await Engine(context).start();
  return context.runResponse;
}
