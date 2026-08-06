import { CustomerAccessMode, Prisma, Role, User } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

type CustomerActor = Pick<User, "id" | "role" | "customerAccessMode">;

export function canAccessAllCustomers(actor: CustomerActor) {
  return actor.role === Role.OWNER || actor.customerAccessMode === CustomerAccessMode.ALL;
}

export function customerWhere(actor: CustomerActor): Prisma.CustomerWhereInput {
  return canAccessAllCustomers(actor) ? {} : { assignedToId: actor.id };
}

export function customerRelationWhere(actor: CustomerActor) {
  return canAccessAllCustomers(actor) ? {} : { customer: { assignedToId: actor.id } };
}

export async function requireCustomerAccess(customerId: string, actor: CustomerActor) {
  const customer = await db.customer.findFirst({
    where: { id: customerId, ...customerWhere(actor) },
  });
  if (!customer) redirect("/?error=forbidden");
  return customer;
}

export async function requireQuoteAccess(quoteId: string, actor: CustomerActor) {
  const quote = await db.quote.findFirst({
    where: { id: quoteId, ...customerRelationWhere(actor) },
  });
  if (!quote) redirect("/?error=forbidden");
  return quote;
}

export async function requireOrderAccess(orderId: string, actor: CustomerActor) {
  const order = await db.order.findFirst({
    where: { id: orderId, ...customerRelationWhere(actor) },
  });
  if (!order) redirect("/?error=forbidden");
  return order;
}

export async function requireTaskAccess(taskId: string, actor: CustomerActor) {
  const task = await db.task.findFirst({
    where: canAccessAllCustomers(actor)
      ? { id: taskId }
      : {
          id: taskId,
          OR: [
            { customer: { assignedToId: actor.id } },
            { customerId: null, assignedToId: actor.id },
          ],
        },
  });
  if (!task) redirect("/?error=forbidden");
  return task;
}
