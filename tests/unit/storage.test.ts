import assert from "node:assert/strict";
import test from "node:test";
import { extensionFor, safeDownloadName, safeStoragePath } from "../../lib/storage";

test("normalizes upload extensions",()=>{
  assert.equal(extensionFor("MODEL.STL"),".stl");
});

test("blocks upload paths outside the storage root",()=>{
  assert.throws(()=>safeStoragePath("../secret.env"),/Invalid storage key/);
});

test("sanitizes response header filenames",()=>{
  assert.equal(safeDownloadName("part\r\n\".stl"),"part___.stl");
});

