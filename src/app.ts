import express from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
export function createApp(path: string) {
 const db = new Database(path);
 db.exec('CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, completed INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)');
 const app = express();
 app.use((req,res,next)=>{ const start=Date.now(); res.on('finish',()=>console.log(JSON.stringify({method:req.method,path:req.path,status:res.statusCode,durationMs:Date.now()-start}))); next(); });
 app.use(express.json({limit:'16kb'}));
 const serialize=(row:any)=>({...row,completed:Boolean(row.completed)});
 app.get('/',(_req,res)=>res.json({name:'api-devops-exemplo',version:'1.0.0'}));
 app.get('/health',(_req,res)=>{db.prepare('SELECT 1').get();res.json({status:'ok'});});
 app.get('/api/tasks',(_req,res)=>res.json(db.prepare('SELECT * FROM tasks ORDER BY createdAt, id').all().map(serialize)));
 app.get('/api/tasks/:id',(req,res)=>{const row=db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);res.status(row?200:404).json(row?serialize(row):{error:'Tarefa não encontrada'});});
 app.post('/api/tasks',(req,res)=>{
 const b=req.body;
 if(!b || typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>200||(b.completed!==undefined&&typeof b.completed!=='boolean')) {res.status(400).json({error:'Dados inválidos'});return;}
 const now=new Date().toISOString(), id=randomUUID();
 db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?)').run(id,b.title.trim(),Number(b.completed??false),now,now);
 res.status(201).location(`/api/tasks/${id}`).json(serialize(db.prepare('SELECT * FROM tasks WHERE id=?').get(id)));
 });
 app.patch('/api/tasks/:id',(req,res)=>{
 const row=db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id) as any;
 if(!row){res.status(404).json({error:'Tarefa não encontrada'});return;}
 const b=req.body;
 if(!b||(!('title' in b)&&!('completed' in b))||(b.title!==undefined&&(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>200))||(b.completed!==undefined&&typeof b.completed!=='boolean')){res.status(400).json({error:'Dados inválidos'});return;}
 db.prepare('UPDATE tasks SET title=?,completed=?,updatedAt=? WHERE id=?').run(b.title?.trim()??row.title,b.completed===undefined?row.completed:Number(b.completed),new Date().toISOString(),req.params.id);
 res.json(serialize(db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id)));
 });
 app.delete('/api/tasks/:id',(req,res)=>{const result=db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id);if(!result.changes){res.status(404).json({error:'Tarefa não encontrada'});return;}res.sendStatus(204);});
 app.use((_req,res)=>{res.status(404).json({error:'Rota não encontrada'});});
 app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(err);res.status(err.status===400||err.status===413?err.status:500).json({error:err.status===400?'JSON inválido':'Erro na requisição'});});
 return {app,db};
}
