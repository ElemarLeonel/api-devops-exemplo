import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
test('CRUD, validação e persistência',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tasks-')); const path=join(dir,'db.sqlite');
 let context=createApp(path);
 try {
 const api=request(context.app);
 await api.get('/health').expect(200);
 await api.post('/api/tasks').send({title:''}).expect(400);
 await api.post('/api/tasks').send({title:'x',completed:'false'}).expect(400);
 const {body}=await api.post('/api/tasks').send({title:' Aula '}).expect(201);
 assert.equal(body.title,'Aula');assert.equal(body.completed,false);
 await api.patch(`/api/tasks/${body.id}`).send({completed:true}).expect(200);
 const list=await api.get('/api/tasks').expect(200);assert.equal(list.body.length,1);
 context.db.close();context=createApp(path);
 const found=await request(context.app).get(`/api/tasks/${body.id}`).expect(200);assert.equal(found.body.completed,true);
 await request(context.app).delete(`/api/tasks/${body.id}`).expect(204);
 await request(context.app).get(`/api/tasks/${body.id}`).expect(404);
 await request(context.app).get('/missing').expect(404);
 await request(context.app).post('/api/tasks').set('Content-Type','application/json').send('{').expect(400);
 } finally {context.db.close();rmSync(dir,{recursive:true,force:true});}
});
