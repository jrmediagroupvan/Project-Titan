"use client";

import { FormEvent, useState } from "react";

type Message={id:string;role:"USER"|"ASSISTANT";content:string};
type ImageRecord={id:string;prompt:string;model:string;createdAt:string};
type Mode="AUTO"|"CRM"|"WEB"|"PRICING";
type Citation={title:string;url:string};

export default function AiChat({initialConversationId,initialMessages,canChat,canCreateImages,provider,configurationError,initialImages,canSearchCrm,canSearchWeb,canPrice,canAnalyzeFiles,canProposeActions,isOwner}:{
  initialConversationId:string|null;
  initialMessages:Message[];
  canChat:boolean;
  canCreateImages:boolean;
  provider:string;
  configurationError:string;
  initialImages:ImageRecord[];
  canSearchCrm:boolean;
  canSearchWeb:boolean;
  canPrice:boolean;
  canAnalyzeFiles:boolean;
  canProposeActions:boolean;
  isOwner:boolean;
}){
  const [conversationId,setConversationId]=useState(initialConversationId);
  const [messages,setMessages]=useState(initialMessages);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [imagePrompt,setImagePrompt]=useState("");
  const [imageBusy,setImageBusy]=useState(false);
  const [images,setImages]=useState(initialImages);
  const [mode,setMode]=useState<Mode>("AUTO");
  const [citations,setCitations]=useState<Citation[]>([]);
  const [toolsUsed,setToolsUsed]=useState<string[]>([]);
  const [listening,setListening]=useState(false);

  async function send(event:FormEvent){
    event.preventDefault();
    const value=message.trim();if(!value||busy)return;
    setBusy(true);setError("");setMessage("");
    const optimistic:Message={id:`local-${Date.now()}`,role:"USER",content:value};
    setMessages(old=>[...old,optimistic]);
    try{
      const response=await fetch("/api/assistant/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId,message:value,mode})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"AI request failed");
      setConversationId(data.conversationId);
      setMessages(old=>[...old,{id:`reply-${Date.now()}`,role:"ASSISTANT",content:data.reply}]);
      setCitations(Array.isArray(data.citations)?data.citations:[]);
      setToolsUsed(Array.isArray(data.toolsUsed)?data.toolsUsed:[]);
      if(!conversationId)history.replaceState(null,"",`/assistant?conversation=${data.conversationId}`);
    }catch(e){setError(e instanceof Error?e.message:"AI request failed");}
    finally{setBusy(false);}
  }

  async function generateImage(event:FormEvent){
    event.preventDefault();const prompt=imagePrompt.trim();if(!prompt||imageBusy)return;
    setImageBusy(true);setError("");
    try{
      const size=(document.getElementById("ai-image-size") as HTMLSelectElement)?.value||"1024x1024";
      const quality=(document.getElementById("ai-image-quality") as HTMLSelectElement)?.value||"auto";
      const response=await fetch("/api/assistant/image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt,size,quality})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Image generation failed");
      setImages(old=>[{id:data.id,prompt,model:"OpenAI",createdAt:new Date().toISOString()},...old]);
      setImagePrompt("");
    }catch(e){setError(e instanceof Error?e.message:"Image generation failed");}
    finally{setImageBusy(false);}
  }

  function dictate(){
    const Recognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!Recognition){setError("Voice dictation is not supported by this browser.");return;}
    const recognition=new Recognition();
    recognition.lang="en-CA";recognition.interimResults=false;recognition.maxAlternatives=1;
    recognition.onstart=()=>setListening(true);
    recognition.onend=()=>setListening(false);
    recognition.onerror=()=>{setListening(false);setError("Voice dictation could not start.");};
    recognition.onresult=(event:any)=>setMessage(old=>`${old}${old?" ":""}${event.results?.[0]?.[0]?.transcript||""}`.trim());
    recognition.start();
  }

  function readLastReply(){
    const last=[...messages].reverse().find(item=>item.role==="ASSISTANT");
    if(!last||!("speechSynthesis" in window))return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(last.content));
  }

  function exportChat(){
    const content=messages.map(item=>`${item.role==="USER"?"You":"TITAN AI"}:\n${item.content}`).join("\n\n");
    const url=URL.createObjectURL(new Blob([content],{type:"text/plain;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="titan-ai-conversation.txt";link.click();
    URL.revokeObjectURL(url);
  }

  const quickPrompts=[
    isOwner&&"Ask me a random question",
    isOwner&&"Help me brainstorm something creative",
    canSearchCrm&&"Show me today’s production risks and overdue work",
    canPrice&&"Calculate a draft quote for 120 g of PLA taking 6 hours",
    canSearchCrm&&"Find open quotes that need follow-up",
    canAnalyzeFiles&&"Inspect my newest uploaded STL and summarize its dimensions",
    canSearchWeb&&"Search the web for current Canadian PLA spool prices",
    canProposeActions&&"Propose a high-priority follow-up task for my latest open quote",
  ].filter(Boolean) as string[];

  return <div className="aiWorkspace">
    <section className="card aiChatPanel">
      <div className="aiModeBar">
        <label>AI mode<select value={mode} onChange={event=>setMode(event.target.value as Mode)}>
          <option value="AUTO">Auto Copilot</option>
          {canSearchCrm&&<option value="CRM">CRM Intelligence</option>}
          {canSearchWeb&&<option value="WEB">Live Web Research</option>}
          {canPrice&&<option value="PRICING">Quote & Pricing</option>}
        </select></label>
        <span className="pill">{provider==="OPENAI"?"OpenAI agent":provider==="OPENROUTER"?"OpenRouter agent":"Private AI"}</span>
      </div>
      <div className="aiMessages">{!messages.length&&<div className="aiEmpty"><h2>TITAN AI Command Center</h2><p className="muted">{isOwner?"Ask general or random questions, search authorized CRM records, calculate quotes, inspect files, research current information, draft content, and stage approved actions.":"Ask about 3D-printing projects, authorized print jobs, quotes, slicer settings, materials, files, troubleshooting, and production."}</p><div className="aiQuickPrompts">{quickPrompts.map(prompt=><button type="button" className="secondary small" key={prompt} onClick={()=>setMessage(prompt)}>{prompt}</button>)}</div></div>}
        {messages.map(item=><article className={`aiBubble ${item.role==="USER"?"user":"assistant"}`} key={item.id}><b>{item.role==="USER"?"You":"TITAN AI"}</b><div>{item.content}</div></article>)}
        {busy&&<div className="aiBubble assistant"><b>TITAN AI</b><div className="muted">Thinking…</div></div>}
      </div>
      {!!toolsUsed.length&&<div className="aiEvidence"><b>Tools used</b><div className="actions">{toolsUsed.map(tool=><span className="pill" key={tool}>{tool.replaceAll("_"," ")}</span>)}</div></div>}
      {!!citations.length&&<div className="aiEvidence"><b>Sources</b>{citations.map(source=><a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.title}</a>)}</div>}
      {(error||configurationError)&&<div className="alert">{error||configurationError}</div>}
      <form onSubmit={send} className="aiComposer"><textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3} placeholder={canChat?"Message TITAN AI…":"You do not have permission to send AI messages."} disabled={!canChat||busy}/><div className="actions"><button type="button" className="secondary" onClick={dictate} disabled={!canChat||busy||listening}>{listening?"Listening…":"🎙 Dictate"}</button><button className="button" disabled={!canChat||busy}>{busy?"Sending…":"Send"}</button></div></form>
      {!!messages.length&&<div className="actions"><button type="button" className="secondary small" onClick={readLastReply}>🔊 Read reply</button><button type="button" className="secondary small" onClick={exportChat}>Export chat</button></div>}
    </section>
    {canCreateImages&&provider==="OPENAI"&&<section className="card">
      <h2>AI Creative Studio</h2><p className="muted">{isOwner?"Create product mockups, social graphics, concept art, promotional images, or other visuals with your effective OpenAI configuration.":"Create visuals for 3D-printing projects, products, models, and promotions with your effective OpenAI configuration."}</p>
      <form onSubmit={generateImage} className="form"><textarea value={imagePrompt} onChange={e=>setImagePrompt(e.target.value)} rows={4} placeholder="Describe the image to create…" required/>
        <div className="formRow"><label>Size<select id="ai-image-size" defaultValue="1024x1024"><option>1024x1024</option><option>1536x1024</option><option>1024x1536</option></select></label><label>Quality<select id="ai-image-quality" defaultValue="auto"><option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
        <button className="button" disabled={imageBusy}>{imageBusy?"Generating…":"Generate image"}</button>
      </form>
      <div className="aiImageGrid">{images.map(image=><figure key={image.id}><a href={`/api/assistant/images/${image.id}`} target="_blank"><img src={`/api/assistant/images/${image.id}`} alt={image.prompt}/></a><figcaption>{image.prompt}</figcaption></figure>)}</div>
    </section>}
  </div>;
}
