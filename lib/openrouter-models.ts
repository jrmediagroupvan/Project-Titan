export type OpenRouterFreeModel={id:string;name:string;contextLength?:number};

export function isZeroCostOpenRouterModel(model:string){
  return model==="openrouter/free"||model.endsWith(":free");
}

export async function listFreeOpenRouterModels():Promise<OpenRouterFreeModel[]>{
  const fallback=[{id:"openrouter/free",name:"OpenRouter Free Models Router"}];
  try{
    const response=await fetch("https://openrouter.ai/api/v1/models",{next:{revalidate:3600},signal:AbortSignal.timeout(8_000)});
    if(!response.ok)return fallback;
    const payload=await response.json() as {data?:Array<{id?:unknown;name?:unknown;context_length?:unknown;pricing?:{prompt?:unknown;completion?:unknown}}>} ;
    const free=(payload.data||[]).filter(model=>{
      const id=typeof model.id==="string"?model.id:"";
      return isZeroCostOpenRouterModel(id)||(Number(model.pricing?.prompt)===0&&Number(model.pricing?.completion)===0);
    }).flatMap(model=>typeof model.id==="string"?[{
      id:model.id,
      name:typeof model.name==="string"?model.name:model.id,
      contextLength:typeof model.context_length==="number"?model.context_length:undefined,
    }]:[]).sort((a,b)=>a.name.localeCompare(b.name));
    return [fallback[0],...free.filter(model=>model.id!=="openrouter/free")];
  }catch{return fallback;}
}
