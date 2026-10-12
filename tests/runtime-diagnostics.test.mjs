import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeJournal} from '../web/js/runtime/diagnostics.js';

test('boot journal records ordered stages and bounded event history',()=>{
 let time=1730000000000;
 const journal=new RuntimeJournal({limit:4,now:()=>++time});
 for (const stage of ['ASSETS','RENDERER','SKIN_READY','RUNNING','ASSETS'])journal.record(stage,'OK');
 assert.equal(journal.events.length,4);
 assert.deepEqual(journal.events.map(e=>e.stage),['RENDERER','SKIN_READY','RUNNING','ASSETS']);
 assert.equal(journal.stage,'ASSETS');
});

test('failure provides a stable error ID without exposing base64 skin data',()=>{
 const journal=new RuntimeJournal({now:()=>1730000000000});
 const e=journal.fail(new Error('Could not open data:image/png;base64,AAAAAAAAAAAAAAAAAAAA'));
 assert.match(e.id,/^BOOT-[0-9A-Z]+$/);
 assert.doesNotMatch(journal.report(),/AAAAAAAA/);
 assert.match(journal.report(),/redacted asset/);
 assert.equal(journal.stage,'ERROR');
});

test('report carries stage transitions but no raw user skin payload',()=>{
 const journal=new RuntimeJournal({now:()=>1730000000000});
 journal.record('ASSETS','Loading bundled sample');
 journal.record('SKIN_READY','Texture ready');
 const result=JSON.parse(journal.report({mode:'overlay'}));
 assert.equal(result.mode,'overlay');
 assert.equal(result.stage,'SKIN_READY');
 assert.equal(result.events.at(-1).stage,'SKIN_READY');
});
