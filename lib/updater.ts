import "server-only";

export type TitanUpdateStatus={
  state:"idle"|"running"|"succeeded"|"failed"|"unavailable";
  startedAt?:string;
  finishedAt?:string;
  exitCode?:number;
  log?:string[];
  message?:string;
};

const updaterUrl="http://updater:8787";

async function updaterRequest(path:string,method:"GET"|"POST"){
  const token=process.env.TITAN_UPDATE_TOKEN;
  if(!token||token.length<32){
    return {state:"unavailable",message:"TITAN_UPDATE_TOKEN is not configured."} satisfies TitanUpdateStatus;
  }
  try{
    const response=await fetch(`${updaterUrl}${path}`,{
      method,
      headers:{Authorization:`Bearer ${token}`},
      cache:"no-store",
      signal:AbortSignal.timeout(5_000),
    });
    const payload=await response.json().catch(()=>({})) as TitanUpdateStatus&{error?:string};
    if(!response.ok)return {state:"unavailable",message:payload.error||`Updater returned HTTP ${response.status}`} satisfies TitanUpdateStatus;
    return payload;
  }catch(error){
    return {state:"unavailable",message:error instanceof Error?error.message:"Updater is unavailable"} satisfies TitanUpdateStatus;
  }
}

export function getTitanUpdateStatus(){return updaterRequest("/status","GET");}
export function startTitanUpdate(){return updaterRequest("/update","POST");}
