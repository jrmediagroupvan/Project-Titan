import Link from "next/link";
import { PermissionKey } from "@prisma/client";
import type { AiConfiguration } from "@/lib/ai";
import { saveOwnAiSettingsAction, testOwnAiSettingsAction } from "@/app/actions";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { listFreeOpenRouterModels } from "@/lib/openrouter-models";

export const dynamic="force-dynamic";

export default async function PersonalAiSettings({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const actor=await requirePermission(PermissionKey.AI_CHAT_VIEW);
  const params=await searchParams;
  const [setting,shared,freeModels]=await Promise.all([
    db.aiUserSetting.findUnique({where:{userId:actor.id}}),
    db.integrationSetting.findUnique({where:{provider:"AI_ASSISTANT"}}),
    listFreeOpenRouterModels(),
  ]);
  let config:Partial<AiConfiguration>={provider:"OPENAI",model:"gpt-5.6-sol",baseUrl:"https://api.openai.com/v1",imageModel:"gpt-image-2"};
  if(setting?.encryptedJson){try{config={...config,...JSON.parse(decryptSecret(setting.encryptedJson))};}catch{}}
  const useServer=setting?.useServerConfig!==false;
  const sharedReady=Boolean(shared?.enabled&&shared.encryptedJson);
  const errorMessage=params.error==="incomplete"
    ?"Your own API key and chat model are required."
    :params.error==="paid-model"
      ?"Zero-cost mode only accepts openrouter/free or an OpenRouter model ID ending in :free."
    :params.error==="shared-disabled"
      ?"The shared TITAN server API is disabled. Ask the OWNER to enable it, or turn off the shared option and enter your own API key."
      :params.error==="shared-incomplete"
        ?"The shared TITAN server API is incomplete or cannot be decrypted. The OWNER must save its provider, key and chat model again."
        :params.error==="save"
          ?"TITAN could not save your AI choice. Check the app logs and confirm the database update was applied."
          :"The connection test failed. Check your effective provider, API key and chat model.";
  return <><div className="top"><div><h1>My AI Settings</h1><p className="muted">Choose the shared TITAN account or your own private API key.</p></div><Link className="secondary" href="/assistant">Back to chat</Link></div>
    {params.success&&<div className="alert goodText">{params.success==="connection"?"AI connection successful.":"Your AI settings were saved."}</div>}
    {params.error&&<div className="alert">{errorMessage}</div>}
    {useServer&&!sharedReady&&<div className="alert">Your current choice uses the shared server API, but that shared account is disabled or incomplete.</div>}
    {useServer&&sharedReady&&<div className="alert goodText">The shared TITAN server API is enabled and available.</div>}
    <section className="card"><form action={saveOwnAiSettingsAction} className="form">
      <label className="check"><input type="checkbox" name="useServerConfig" defaultChecked={useServer}/> Use the shared TITAN server API</label>
      <p className="muted">Turn this off to bill AI requests to your own OpenAI or OpenRouter account. Your private key remains encrypted and is never shown again.</p>
      <label>My provider<select name="provider" defaultValue={config.provider==="OPENROUTER"?"OPENROUTER":"OPENAI"}><option value="OPENAI">OpenAI</option><option value="OPENROUTER">OpenRouter</option></select></label>
      <div className="formRow"><label>Chat model<input name="model" list="personal-openrouter-free-models" defaultValue={config.model||""} placeholder="openrouter/free"/></label><label>OpenAI image model<input name="imageModel" defaultValue={config.imageModel||"gpt-image-2"}/></label></div>
      <datalist id="personal-openrouter-free-models">{freeModels.map(model=><option key={model.id} value={model.id}>{model.name}</option>)}</datalist>
      <label className="check"><input type="checkbox" name="zeroCostOnly" defaultChecked={config.provider==="OPENROUTER"&&(config.zeroCostOnly??true)}/> Restrict my OpenRouter account to zero-cost models only</label>
      <p className="muted">Use <code>openrouter/free</code> for automatic free routing. TITAN connects directly and adds no surcharge.</p>
      <p className="muted">For security, personal accounts use the official OpenAI or OpenRouter API address. The OWNER can configure a custom local endpoint as the shared server provider.</p>
      <label>My API key<input name="apiKey" type="password" autoComplete="new-password" placeholder={setting?.encryptedJson?"Saved — leave blank to keep it":"Paste your private API key"}/></label>
      <label>My optional assistant instructions<textarea name="systemPrompt" rows={4} defaultValue={config.systemPrompt||""} placeholder="Optional preferences for your chats"/></label>
      <button type="submit" className="button">Save my AI choice</button>
    </form></section>
    <form action={testOwnAiSettingsAction} className="section"><button className="secondary">Test my effective connection</button></form>
  </>;
}
