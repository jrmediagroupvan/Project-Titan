import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";

const port=Number(process.env.PORT||1240);
const host=process.env.HOST||"0.0.0.0";
const executable=process.env.BAMBU_STUDIO_CLI||"";
const profileMapPath=process.env.BAMBU_PROFILE_MAP||"";
const token=process.env.TITAN_SLICER_TOKEN||"";
const maxBytes=75*1024*1024;

function send(response,status,payload){
  response.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});
  response.end(JSON.stringify(payload));
}

function authenticated(request){
  const provided=String(request.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!token||!provided)return false;
  const expected=createHash("sha256").update(token).digest();
  const actual=createHash("sha256").update(provided).digest();
  return timingSafeEqual(expected,actual);
}

async function jsonBody(request){
  const chunks=[];let bytes=0;
  for await(const chunk of request){
    bytes+=chunk.length;
    if(bytes>maxBytes)throw new Error("Request exceeds the 75 MB slicer-agent limit");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function seconds(value){
  let total=0;
  for(const match of String(value).matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/gi)){
    const amount=Number(match[1]),unit=match[2].toLowerCase();
    total+=amount*(unit==="d"?86400:unit==="h"?3600:unit==="m"?60:1);
  }
  return Math.round(total);
}

function parseGcode(gcode){
  const weight=gcode.match(/total filament weight\s*\[g\]\s*:\s*([\d.]+)/i)||gcode.match(/total filament used\s*\[g\]\s*=\s*([\d.]+)/i);
  const times=gcode.match(/model printing time\s*:\s*([^;\r\n]+)\s*;\s*total estimated time\s*:\s*([^;\r\n]+)/i);
  const legacy=gcode.match(/estimated printing time\s*\(normal mode\)\s*=\s*([^;\r\n]+)/i);
  const modelTimeSeconds=times?seconds(times[1]):legacy?seconds(legacy[1]):0;
  const totalTimeSeconds=times?seconds(times[2]):modelTimeSeconds;
  const materialGrams=weight?Number(weight[1]):0;
  const slicerVersion=gcode.match(/;\s*BambuStudio\s+([^\r\n]+)/i)?.[1]?.trim();
  if(!(materialGrams>0)||!(totalTimeSeconds>0))throw new Error("Bambu output is missing filament weight or print time");
  return{materialGrams,modelTimeSeconds,totalTimeSeconds,slicerVersion};
}

function parseArchive(buffer){
  const entries=unzipSync(new Uint8Array(buffer));
  const gcode=Object.entries(entries).filter(([name])=>/\.gcode$/i.test(name));
  if(!gcode.length)throw new Error("Bambu output does not contain G-code");
  const estimates=gcode.map(([,bytes])=>parseGcode(Buffer.from(bytes).toString("utf8")));
  return{
    materialGrams:estimates.reduce((sum,item)=>sum+item.materialGrams,0),
    modelTimeSeconds:estimates.reduce((sum,item)=>sum+item.modelTimeSeconds,0),
    totalTimeSeconds:estimates.reduce((sum,item)=>sum+item.totalTimeSeconds,0),
    slicerVersion:estimates.find(item=>item.slicerVersion)?.slicerVersion,
  };
}

async function run(exe,args){
  await new Promise((resolve,reject)=>{
    const child=spawn(exe,args,{shell:false,windowsHide:true,stdio:["ignore","pipe","pipe"]});
    let stderr="";
    const timer=setTimeout(()=>{child.kill("SIGKILL");reject(new Error("Bambu Studio timed out after 12 minutes"));},12*60_000);
    child.stderr.on("data",chunk=>{stderr=(stderr+chunk.toString()).slice(-8000);});
    child.on("error",error=>{clearTimeout(timer);reject(error);});
    child.on("exit",code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`Bambu Studio exited with code ${code}: ${stderr.slice(-1000)}`));});
  });
}

async function slice(payload){
  if(!executable||!profileMapPath||!token)throw new Error("Slicer agent environment is incomplete");
  const profileKey=String(payload.profileKey||"");
  if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(profileKey))throw new Error("Invalid profile key");
  const profiles=JSON.parse(await readFile(path.resolve(profileMapPath),"utf8"));
  const profile=profiles[profileKey];
  if(!profile?.machine||!profile?.process||!profile?.filament)throw new Error(`Unknown or incomplete profile: ${profileKey}`);
  const original=path.basename(String(payload.fileName||"model.stl")).replace(/[^a-zA-Z0-9_.-]/g,"_");
  const extension=path.extname(original).toLowerCase();
  if(![".stl",".3mf"].includes(extension))throw new Error("Only STL and 3MF inputs are supported");
  const bytes=Buffer.from(String(payload.fileBase64||""),"base64");
  if(!bytes.length||bytes.length>50*1024*1024)throw new Error("Invalid model file");
  const quantity=Math.min(100,Math.max(1,Math.round(Number(payload.quantity)||1)));
  const temp=await mkdtemp(path.join(os.tmpdir(),"titan-slice-"));
  try{
    const input=path.join(temp,original),output=path.join(temp,"titan-output.gcode.3mf");
    await writeFile(input,bytes,{flag:"wx"});
    const args=[
      "--debug","2","--orient","--arrange","1",
      "--load-settings",`${path.resolve(profile.machine)};${path.resolve(profile.process)}`,
      "--load-filaments",path.resolve(profile.filament),
      "--slice","0","--export-3mf",output,
      ...Array.from({length:quantity},()=>input),
    ];
    await run(executable,args);
    const estimate=parseArchive(await readFile(output));
    return{status:"SLICED",...estimate,profileKey,printer:profile.printer||profileKey,process:profile.processName||path.basename(profile.process),filament:profile.filamentName||path.basename(profile.filament),nozzleMm:Number(profile.nozzleMm)||undefined};
  }finally{
    await rm(temp,{recursive:true,force:true}).catch(()=>{});
  }
}

http.createServer(async(request,response)=>{
  if(request.method==="GET"&&request.url==="/health")return send(response,200,{ok:true,configured:Boolean(executable&&profileMapPath&&token)});
  if(request.method!=="POST"||request.url!=="/slice")return send(response,404,{error:"Not found"});
  if(!authenticated(request))return send(response,401,{error:"Unauthorized"});
  try{return send(response,200,await slice(await jsonBody(request)));}
  catch(error){console.error(error);return send(response,400,{error:error instanceof Error?error.message:"Slicing failed"});}
}).listen(port,host,()=>console.log(`TITAN Bambu slicer agent listening on ${host}:${port}`));
