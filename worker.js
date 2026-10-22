import { DurableObject } from "cloudflare:workers";
import { onRequest as contentHandler } from "./functions/api/admin/content.js";

export class BandContent extends DurableObject {
  getSnapshot(){
    return this.ctx.storage.kv.get("content") ?? null;
  }
  initialize(data){
    let current=this.ctx.storage.kv.get("content");
    if(!current){
      current={sha:"initial",data};
      this.ctx.storage.kv.put("content",current);
    }
    return current;
  }
  save(expectedSha,data){
    const current=this.ctx.storage.kv.get("content");
    if(!current)return {error:"Content has not been initialized. Reload the admin page."};
    if(current.sha!==expectedSha)return {error:"Another editor changed the site. Reload before publishing to avoid overwriting their changes."};
    const next={sha:crypto.randomUUID(),data,updatedAt:Date.now()};
    this.ctx.storage.kv.put("content",next);
    return {ok:true,sha:next.sha};
  }
}
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export default {
 async fetch(request,env,ctx){
   const url=new URL(request.url),path=url.pathname;
   if(path==="/api/health"){
     return request.method==="GET"?respond({ok:true,service:"i90sdet-worker",revision:"storage-v1",storage:env.BAND_CONTENT?"available":"binding-missing"}):respond({error:"Method not allowed"},405);
   }
   if(path==="/api/admin/content")return contentHandler({request,env,ctx});
   if(path.startsWith("/api/"))return respond({error:"API route not found"},404);
   if(path==="/content.json"){
     if(request.method!=="GET"&&request.method!=="HEAD")return respond({error:"Method not allowed"},405);
     if(!env.BAND_CONTENT)return respond({error:"Site data store unavailable"},503);
     try{
       const saved=await env.BAND_CONTENT.getByName("interstate90s-content").getSnapshot();
       if(saved)return request.method==="HEAD"?new Response(null,{headers:{"content-type":"application/json","cache-control":"no-store"}}):respond(saved.data);
     }catch{return respond({error:"Site data store temporarily unavailable"},503)}
     const fallback=await env.ASSETS.fetch(request);
     const headers=new Headers(fallback.headers);headers.set("cache-control","no-store");
     return new Response(request.method==="HEAD"?null:fallback.body,{status:fallback.status,headers});
   }
   if(!env.ASSETS)return respond({error:"Static assets binding missing"},503);
   if(path==="/admin")return Response.redirect(url.origin+"/admin/",308);
   return env.ASSETS.fetch(request);
 }
};
