import type { AppContext } from './types/context.interface';

export const botConfigMiddleware = async (ctx: AppContext, next: () => Promise<void>) => {
  ctx.isAdmin = process.env.TG_ADMIN_ID === ctx.from?.id.toString();

  const groupId = process.env.TG_GROUP_ID;

  if (groupId) {
    ctx.groupId = groupId;
  }

  await next();
};
