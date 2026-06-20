import type { AppContext } from './types/context.interface';

export const botConfigMiddleware = async (ctx: AppContext, next: () => Promise<void>) => {
  const { TG_GROUP_ID_BILLS, TG_GROUP_ID_REPORTS, TG_GROUP_ID_ORDERS, TG_ADMIN_ID } = process.env;

  if (TG_ADMIN_ID) {
    ctx.isAdmin = process.env.TG_ADMIN_ID === ctx.from?.id.toString();
  }

  if (TG_GROUP_ID_ORDERS && TG_GROUP_ID_BILLS && TG_GROUP_ID_REPORTS) {
    ctx.ordersGroupId = TG_GROUP_ID_ORDERS;
    ctx.billsGroupId = TG_GROUP_ID_BILLS;
    ctx.reportsGroupId = TG_GROUP_ID_REPORTS;
  }

  await next();
};
