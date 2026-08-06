import test from "node:test";
import assert from "node:assert/strict";
import { parseQuoteRequest, senderAddress } from "../../lib/email-quote";

test("extracts a complete 3D printing quote request",()=>{
  const parsed=parseQuoteRequest({
    from:"Terry Customer <terry@example.com>",
    subject:"Quote request for custom keychains",
    text:"Can you print 25 keychains in black PLA? Each one is about 18 grams and takes 42 minutes per item.",
  });
  assert.equal(parsed.senderEmail,"terry@example.com");
  assert.equal(parsed.senderName,"Terry Customer");
  assert.equal(parsed.quantity,25);
  assert.equal(parsed.material,"PLA");
  assert.equal(parsed.colour,"black");
  assert.equal(parsed.estimatedGrams,18);
  assert.equal(parsed.estimatedMinutes,42);
  assert.deepEqual(parsed.missingFields,[]);
  assert.equal(parsed.likelyQuoteRequest,true);
});

test("does not invent missing pricing inputs",()=>{
  const parsed=parseQuoteRequest({
    from:"customer@example.com",
    subject:"How much to 3D print my STL?",
    text:"Please send me a price.",
  });
  assert.equal(parsed.material,null);
  assert.equal(parsed.estimatedGrams,null);
  assert.equal(parsed.estimatedMinutes,null);
  assert.deepEqual(parsed.missingFields,["material","estimated grams per item","estimated print minutes per item"]);
});

test("parses a plain sender address",()=>{
  assert.deepEqual(senderAddress("customer@example.com"),{name:null,email:"customer@example.com"});
});
