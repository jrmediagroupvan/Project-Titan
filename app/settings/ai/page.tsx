import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/authorization";
import { saveAiSettingsAction, testAiSettingsAction } from "@/app/actions";
import type { AiConfiguration } from "@/lib/ai";
import { listFreeOpenRouterModels } from "@/lib/openrouter-models";

export const dynamic="force-dynamic";

export default async function AiSettings({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  await requireOwner();
  const params=await searchParams;
  const [row,freeModels]=await Promise.all([db.integrationSetting.findUnique({where:{provider:"AI_ASSISTANT"}}),listFreeOpenRouterModels()]);
  let config:Partial<AiConfiguration>={provider:"OPENAI",model:"gpt-5.6-sol",baseUrl:"https://api.openai.com/v1",imageModel:"gpt-image-2"};
  if(row?.encryptedJson){try{config={...config,...JSON.parse(decryptSecret(row.encryptedJson))};}catch{}}
  const errorMessage=params.error==="incomplete"
    ?"An API key and chat model are required before shared AI can be enabled."
    :params.error==="paid-model"
      ?"Zero-cost mode only accepts openrouter/free or an OpenRouter model ID ending in :free."
    :params.error==="save"
      ?"TITAN could not save the shared AI settings. Check the app logs and confirm the database update was applied."
      :"The AI connection test failed. Check the key, chat model, provider and API URL.";
  return <><div className="top"><div><h1>Shared TITAN AI</h1><p className="muted">Configure the server account that authorized users may share.</p></div></div>
    {params.success==="saved"&&<div className="alert goodText">Shared AI settings saved. Shared access is now {row?.enabled?"enabled":"disabled"}.</div>}
    {params.success==="connection"&&<div className="alert goodText">AI connection successful.</div>}
    {params.error&&<div className="alert">{errorMessage}</div>}
    {!row?.enabled&&<div className="alert">Shared TITAN AI is disabled. Users who select the shared server API cannot chat until you enable it and save this page.</div>}
    <section className="card"><form action={saveAiSettingsAction} className="form">
      <label className="check"><input type="checkbox" name="enabled" defaultChecked={row?.enabled}/> Enable shared TITAN AI</label>
      <label>Provider<select name="provider" defaultValue={config.provider}><option value="OPENAI">OpenAI</option><option value="OPENROUTER">OpenRouter</option><option value="CUSTOM">Custom OpenAI-compatible server</option></select></label>
      <div className="formRow"><label>Chat model<input name="model" list="openrouter-free-models" defaultValue={config.model||""} placeholder="openrouter/free"/></label><label>OpenAI image model (OpenAI provider only)<input name="imageModel" defaultValue={config.provider==="OPENAI"?(config.imageModel||"gpt-image-2"):"gpt-image-2"}/></label></div>
      <datalist id="openrouter-free-models">{freeModels.map(model=><option key={model.id} value={model.id}>{model.name}</option>)}</datalist>
      <label className="check"><input type="checkbox" name="zeroCostOnly" defaultChecked={config.provider==="OPENROUTER"&&(config.zeroCostOnly??true)}/> Restrict OpenRouter to zero-cost models only</label>
      <label className="check"><input type="checkbox" name="customerPortalEnabled" defaultChecked={config.customerPortalEnabled===true}/> Enable the customer portal AI assistant</label>
      <p className="muted">Customer AI receives only the quotes, orders, production jobs, payments, shipments, and files belonging to the portal link&apos;s customer. It cannot use staff tools or perform changes.</p>
      <p className="muted">Use <code>openrouter/free</code> to route automatically across currently available free models, or select any live <code>:free</code> model above. TITAN adds no usage surcharge.</p>
      <label>API base URL<input name="baseUrl" defaultValue={config.baseUrl||""} required/></label>
      <label>API key<input name="apiKey" type="password" autoComplete="new-password" placeholder={row?.encryptedJson?"Saved — leave blank to keep it":"Paste API key"} /></label>
      <label>Custom chatbot instructions<textarea name="systemPrompt" rows={6} defaultValue={config.systemPrompt||"You are TITAN AI, a concise assistant for a Canadian 3D-printing business. Never invent prices, weights, print times, customer facts, or completed actions."}/></label>
      <button type="submit" className="button">Save shared AI settings</button>
    </form></section>
    {row?.enabled&&row.encryptedJson&&<form action={testAiSettingsAction} className="section"><button className="secondary">Test saved connection</button></form>}
    <section className="card section"><h2>Privacy and access</h2><p className="muted">API keys are encrypted and used only on the server. Grant AI Assistant, AI Chat, and AI Images permissions separately under Feature Categories & Permissions. CRM context is filtered using each user&apos;s existing customer and feature permissions.</p></section>
  </>;
}
