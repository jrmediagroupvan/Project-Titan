import { PermissionKey } from "@prisma/client";
import { customerWhere, customerRelationWhere } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { userAllows } from "@/lib/permissions";

type Actor={id:string;role:any;customerAccessMode:any};

export async function buildTitanContext(actor:Actor){
  const sections:string[]=[];
  if(await userAllows(actor.id,actor.role,PermissionKey.CUSTOMERS_VIEW)){
    const customers=await db.customer.findMany({where:customerWhere(actor),take:25,orderBy:{updatedAt:"desc"},select:{name:true,company:true,notes:true}});
    sections.push(`Accessible customers:\n${customers.map(x=>`- ${x.name}${x.company?` (${x.company})`:""}${x.notes?`: ${x.notes.slice(0,180)}`:""}`).join("\n")||"- None"}`);
  }
  if(await userAllows(actor.id,actor.role,PermissionKey.QUOTES_VIEW)){
    const quotes=await db.quote.findMany({where:customerRelationWhere(actor),take:20,orderBy:{updatedAt:"desc"},include:{customer:{select:{name:true}},items:{take:3}}});
    sections.push(`Recent accessible quotes:\n${quotes.map(x=>`- ${x.number}, ${x.customer.name}, ${x.status}, CAD $${(x.totalCents/100).toFixed(2)}: ${x.items.map(i=>i.description).join("; ")}`).join("\n")||"- None"}`);
  }
  if(await userAllows(actor.id,actor.role,PermissionKey.ORDERS_VIEW)){
    const orders=await db.order.findMany({where:customerRelationWhere(actor),take:20,orderBy:{updatedAt:"desc"},include:{customer:{select:{name:true}}}});
    sections.push(`Recent accessible orders:\n${orders.map(x=>`- ${x.number}, ${x.customer.name}, ${x.status}, CAD $${(x.totalCents/100).toFixed(2)}`).join("\n")||"- None"}`);
  }
  if(await userAllows(actor.id,actor.role,PermissionKey.TASKS_VIEW)){
    const tasks=await db.task.findMany({where:actor.customerAccessMode==="ALL"||actor.role==="OWNER"?{}:{OR:[{customer:{assignedToId:actor.id}},{customerId:null,assignedToId:actor.id}]},take:20,orderBy:{createdAt:"desc"},select:{title:true,status:true,priority:true,dueAt:true}});
    sections.push(`Accessible tasks:\n${tasks.map(x=>`- ${x.title}, ${x.status}, ${x.priority}${x.dueAt?`, due ${x.dueAt.toISOString().slice(0,10)}`:""}`).join("\n")||"- None"}`);
  }
  return sections.join("\n\n");
}

