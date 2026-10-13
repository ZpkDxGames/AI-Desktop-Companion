import test from 'node:test';
import assert from 'node:assert/strict';
import {readItemArchive} from '../web/js/engine/item-archive.js';
const fixture={"valid":"UEsDBBQAAAAIAFWoTV3KdgpZXQAAAGEAAAAoAAAAYXNzZXRzL21pbmVjcmFmdC90ZXh0dXJlcy9pdGVtL2FwcGxlLnBuZ+sM8HPn5ZLiYmBg4PX0cAkC0gIgzMEGJOU//08EUhqeLo4hFXOSEyQyDnScEax88W2+hG/+k/KDXw0DXzUFMrvxSsiw8dgwMLxRZJGwVzbIBOph8HT1c1nnlNAEAFBLAwQUAAAACABVqE1dynYKWV0AAABhAAAAJwAAAGFzc2V0cy9taW5lY3JhZnQvdGV4dHVyZXMvaXRlbS9jYWtlLnBuZ+sM8HPn5ZLiYmBg4PX0cAkC0gIgzMEGJOU//08EUhqeLo4hFXOSEyQyDnScEax88W2+hG/+k/KDXw0DXzUFMrvxSsiw8dgwMLxRZJGwVzbIBOph8HT1c1nnlNAEAFBLAwQUAAAACABVqE1dKdxC+Q4AAAAMAAAAFwAAAGlycmVsZXZhbnQvcGFzc3dvcmQudHh0y8svUShOzUlNLklNAQBQSwECFAMUAAAACABVqE1dynYKWV0AAABhAAAAKAAAAAAAAAAAAAAAgAEAAAAAYXNzZXRzL21pbmVjcmFmdC90ZXh0dXJlcy9pdGVtL2FwcGxlLnBuZ1BLAQIUAxQAAAAIAFWoTV3KdgpZXQAAAGEAAAAnAAAAAAAAAAAAAACAAaMAAABhc3NldHMvbWluZWNyYWZ0L3RleHR1cmVzL2l0ZW0vY2FrZS5wbmdQSwECFAMUAAAACABVqE1dKdxC+Q4AAAAMAAAAFwAAAAAAAAAAAAAAgAFFAQAAaXJyZWxldmFudC9wYXNzd29yZC50eHRQSwUGAAAAAAMAAwDwAAAAiAEAAAAA","traversal":"UEsDBBQAAAAIAFWoTV3KdgpZXQAAAGEAAAAMAAAALi4vYXBwbGUucG5n6wzwc+flkuJiYGDg9fRwCQLSAiDMwQYk5T//TwRSGp4ujiEVc5ITJDIOdJwRrHzxbb6Eb/6T8oNfDQNfNQUyu/FKyLDx2DAwvFFkkbBXNsgE6mHwdPVzWeeU0AQAUEsBAhQDFAAAAAgAVahNXcp2ClldAAAAYQAAAAwAAAAAAAAAAAAAAIABAAAAAC4uL2FwcGxlLnBuZ1BLBQYAAAAAAQABADoAAACHAAAAAAA=","duplicate":"UEsDBBQAAAAIAFWoTV3KdgpZXQAAAGEAAAAJAAAAYXBwbGUucG5n6wzwc+flkuJiYGDg9fRwCQLSAiDMwQYk5T//TwRSGp4ujiEVc5ITJDIOdJwRrHzxbb6Eb/6T8oNfDQNfNQUyu/FKyLDx2DAwvFFkkbBXNsgE6mHwdPVzWeeU0AQAUEsDBBQAAAAIAFWoTV3KdgpZXQAAAGEAAAAoAAAAYXNzZXRzL21pbmVjcmFmdC90ZXh0dXJlcy9pdGVtL2FwcGxlLnBuZ+sM8HPn5ZLiYmBg4PX0cAkC0gIgzMEGJOU//08EUhqeLo4hFXOSEyQyDnScEax88W2+hG/+k/KDXw0DXzUFMrvxSsiw8dgwMLxRZJGwVzbIBOph8HT1c1nnlNAEAFBLAQIUAxQAAAAIAFWoTV3KdgpZXQAAAGEAAAAJAAAAAAAAAAAAAACAAQAAAABhcHBsZS5wbmdQSwECFAMUAAAACABVqE1dynYKWV0AAABhAAAAKAAAAAAAAAAAAAAAgAGEAAAAYXNzZXRzL21pbmVjcmFmdC90ZXh0dXJlcy9pdGVtL2FwcGxlLnBuZ1BLBQYAAAAAAgACAI0AAAAnAQAAAAA=","png":"iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVR4nGNgGGjAiMwReej2nxhNb+R3wfUxUeqCUQNGDRgcBgw8AADsIQQYPyMwaQAAAABJRU5ErkJggg=="};
const file=(data,name='minecraft-client.jar')=>new File([Buffer.from(data,'base64')],name,{type:'application/java-archive'});
test('explicit client JAR import reads only allowlisted vanilla PNGs and maps the actual cake item',async()=>{
 const items=await readItemArchive(file(fixture.valid));assert.deepEqual(items.map(x=>x.name),['apple.png','cake_slice.png']);
 for(const item of items){assert.equal(item.type,'image/png');assert.deepEqual(Buffer.from(await item.arrayBuffer()),Buffer.from(fixture.png,'base64'));}
});
test('archive import rejects traversal-only, duplicate and malformed directories',async()=>{
 await assert.rejects(readItemArchive(file(fixture.traversal)),/No supported/);
 await assert.rejects(readItemArchive(file(fixture.duplicate)),/Duplicate/);
 await assert.rejects(readItemArchive(new File(['random text'],'x.zip')),/at most|Invalid/);
});
test('archive import detects corrupted selected data and declared expansion bombs',async()=>{
 const original=Buffer.from(fixture.valid,'base64');const corrupt=Buffer.from(original);corrupt[90]^=0xff;
 await assert.rejects(readItemArchive(new File([corrupt],'x.zip')));
 const large=Buffer.from(original),directory=large.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));large.writeUInt32LE(160*1024+1,directory+24);
 await assert.rejects(readItemArchive(new File([large],'x.zip')),/oversized/);
});

