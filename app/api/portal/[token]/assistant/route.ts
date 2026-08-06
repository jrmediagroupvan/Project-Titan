import { createHash } from "node:crypto";
import { createAiReply, loadAiConfiguration } from "@/lib/ai";
import { db } from "@/lib/db";

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  const tokenHash=createHash("sha256").update(token).digest("hex");
  const access=await db.portalAccessToken.findUnique({
    where:{tokenHash},
    include:{customer:{include:{
      quotes:{orderBy:{createdAt:"desc"},take:20,include:{items:true}},
      orders:{orderBy:{createdAt:"desc"},take:20,include:{jobs:{include:{printer:{select:{name:true}}}},payments:true,shipments:true}},
      uploads:{orderBy:{createdAt:"desc"},take:20,select:{originalName:true,fileType:true,bytes:true,analysisJson:true,createdAt:true}},
    }}},
  });
  if(!access||access.revokedAt||(access.expiresAt&&access.expiresAt<=new Date()))return Response.json({error:"This customer portal link is invalid or expired."},{status:404});
  const recentRequests=await db.aiToolRun.count({where:{scopeKey:`portal:${access.customerId}`,toolName:"CUSTOMER_PORTAL_CHAT",createdAt:{gte:new Date(Date.now()-10*60*1000)}}});
  if(recentRequests>=20)return Response.json({error:"Please wait a few minutes before asking more questions."},{status:429});
  const body=await request.json().catch(()=>({})) as {message?:unknown;history?:unknown};
  const message=typeof body.message==="string"?body.message.trim():"";
  if(!message||message.length>3000)return Response.json({error:"Enter a message up to 3,000 characters."},{status:400});
  const history:{role:"user"|"assistant";content:string}[]=Array.isArray(body.history)?body.history.slice(-10).flatMap((item:any)=>{
    const role:"user"|"assistant"|null=item?.role==="assistant"?"assistant":item?.role==="user"?"user":null;
    const content=typeof item?.content==="string"?item.content.slice(0,3000):"";
    return role&&content?[{role,content}]:[];
  }):[];
  try{
    const config=await loadAiConfiguration();
    if(!config.customerPortalEnabled)return Response.json({error:"Customer portal AI is not enabled."},{status:503});
    const customer=access.customer;
    const record={
      customer:{name:customer.name,company:customer.company},
      quotes:customer.quotes.map(quote=>({number:quote.number,status:quote.status,currency:quote.currency,totalCents:quote.totalCents,expiresAt:quote.expiresAt,items:quote.items.map(item=>({description:item.description,quantity:item.quantity,material:item.material,colour:item.colour}))})),
      orders:customer.orders.map(order=>({number:order.number,status:order.status,totalCents:order.totalCents,paidCents:order.paidCents,dueDate:order.dueDate,jobs:order.jobs.map(job=>({status:job.status,material:job.material,colour:job.colour,estimatedMinutes:job.estimatedMinutes,printer:job.printer?.name||null})),payments:order.payments.map(payment=>({status:payment.status,amountCents:payment.amountCents,paidAt:payment.paidAt})),shipments:order.shipments.map(shipment=>({status:shipment.status,carrier:shipment.carrier,trackingNumber:shipment.trackingNumber,shippedAt:shipment.shippedAt,deliveredAt:shipment.deliveredAt}))})),
      files:customer.uploads,
    };
    const instructions=[
      "You are the Project TITAN customer portal assistant for a 3D-printing business.",
      "Answer only from this customer's supplied records. Never mention internal costs, markup, profit, staff notes, other customers, system configuration, or API keys.",
      "You cannot change, cancel, approve, refund, send, or delete anything. Explain that requests requiring action must be handled by staff.",
      "Do not invent dates, statuses, prices, tracking, or estimates. Money values are integer cents in their stated currency.",
      `Customer record:\n${JSON.stringify(record)}`,
    ].join("\n\n");
    const reply=await createAiReply(config,instructions,[...history,{role:"user",content:message}]);
    await db.$transaction([
      db.portalAccessToken.update({where:{id:access.id},data:{lastUsedAt:new Date()}}),
      db.aiToolRun.create({data:{scopeKey:`portal:${access.customerId}`,toolName:"CUSTOMER_PORTAL_CHAT",outputSummary:"Customer portal response completed"}}),
    ]);
    return Response.json({reply});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Customer AI request failed"},{status:502});
  }
}
