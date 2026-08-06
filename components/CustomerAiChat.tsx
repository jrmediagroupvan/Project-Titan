"use client";

import { FormEvent, useState } from "react";

type Message={role:"user"|"assistant";content:string};

export default function CustomerAiChat({token}:{token:string}){
  const [messages,setMessages]=useState<Message[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function send(event:FormEvent){
    event.preventDefault();
    const value=message.trim();
    if(!value||busy)return;
    const next=[...messages,{role:"user" as const,content:value}];
    setMessages(next);setMessage("");setBusy(true);setError("");
    try{
      const response=await fetch(`/api/portal/${encodeURIComponent(token)}/assistant`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:value,history:messages.slice(-10)}),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Customer AI request failed");
      setMessages(old=>[...old,{role:"assistant",content:data.reply}]);
    }catch(error){
      setError(error instanceof Error?error.message:"Customer AI request failed");
    }finally{setBusy(false);}
  }

  return <section className="card section">
    <h2>Ask TITAN about your print jobs</h2>
    <p className="muted">Ask about your quotes, order status, production, payments, shipping, or uploaded files. This assistant can only see information connected to your customer portal.</p>
    <div className="aiMessages portalAiMessages">
      {!messages.length&&<div className="aiQuickPrompts">
        {["What is the status of my latest print job?","Do I have any quotes waiting for approval?","Has my order shipped yet?"].map(prompt=><button type="button" className="secondary small" key={prompt} onClick={()=>setMessage(prompt)}>{prompt}</button>)}
      </div>}
      {messages.map((item,index)=><article className={`aiBubble ${item.role==="user"?"user":"assistant"}`} key={`${item.role}-${index}`}><b>{item.role==="user"?"You":"TITAN"}</b><div>{item.content}</div></article>)}
      {busy&&<div className="aiBubble assistant"><b>TITAN</b><div className="muted">Checking your records…</div></div>}
    </div>
    {error&&<div className="alert">{error}</div>}
    <form onSubmit={send} className="aiComposer"><textarea rows={3} value={message} onChange={event=>setMessage(event.target.value)} maxLength={3000} placeholder="Ask about your print job…"/><button className="button" disabled={busy}>{busy?"Checking…":"Ask TITAN"}</button></form>
  </section>;
}
