import { DurableObject } from "cloudflare:workers";
import { onRequest as contentHandler } from "./functions/api/admin/content.js";
import { onRequest as importHandler } from "./functions/api/admin/import.js";

export class BandContent extends DurableObject {
  getSnapshot(){
    return this.ctx.storage.kv.get("content") ?? null;
  }
  initialize(data){
    let current=this.ctx.storage.kv.get("content");
    if(!current){
      current={sha:crypto.randomUUID(),data,seedTag:"video-import-20261022-v3"};
      this.ctx.storage.kv.put("content",current);
    }
    return current;
  }
  mergeSeed(seed){
    let current=this.ctx.storage.kv.get("content");
    if(!current)return this.initialize(seed);
    if(current.seedTag==="video-import-20261022-v3")return current;
    const existing=structuredClone(current.data);
    const uniqueEvents=(first,second)=>{
      const m=new Map();
      for(const event of [...first,...second]){
        if(!event||!event.date||!event.venue)continue;
        const key=event.date+"|"+event.venue.toLowerCase().replace(/[^a-z0-9]/g,"");
        if(!m.has(key))m.set(key,event);
      }
      return [...m.values()].sort((a,b)=>b.date.localeCompare(a.date));
    };
    existing.upcomingShows=uniqueEvents(existing.upcomingShows||[],seed.upcomingShows||[]);
    existing.recentShows=uniqueEvents(existing.recentShows||[],seed.recentShows||[]);
    existing.archivePosts=existing.archivePosts||[];
    // One-time, idempotent import of the eight verified WordPress clips.
    // Keep any clips added by the band through the admin dashboard.
    const videoKey=v=>{
      try{const u=new URL(v.url);const id=u.searchParams.get("v")||u.pathname.match(/\/(?:shorts|embed)\/([\w-]{11})/)?.[1]||(u.hostname==="youtu.be"?u.pathname.slice(1):"");return id||u.href}
      catch{return String(v?.url||"")}
    };
    const keys=new Set();
    existing.videos=[...(seed.videos||[]),...(existing.videos||[])].filter(v=>{
      if(!v||typeof v.url!=="string")return false;
      const id=videoKey(v);if(keys.has(id))return false;
      keys.add(id);return true;
    });

    current={...current,sha:crypto.randomUUID(),data:existing,seedTag:"video-import-20261022-v3"};
    this.ctx.storage.kv.put("content",current);
    return current;
  }
  importArchive(posts){
    const current=this.ctx.storage.kv.get("content");
    if(!current)return {error:"Content needs initial loading before import."};
    const data=structuredClone(current.data);
    const original=data.archivePosts||[];
    const keys=new Set(original.map(p=>p.url));
    const filtered=posts.filter(p=>p&&p.url&&!keys.has(p.url)&&keys.add(p.url));
    data.archivePosts=[...original,...filtered].sort((a,b)=>b.published.localeCompare(a.published));
    const next={...current,sha:crypto.randomUUID(),data,archiveImportAt:new Date().toISOString()};
    this.ctx.storage.kv.put("content",next);
    return {imported:filtered.length,total:data.archivePosts.length,sha:next.sha};
  }
  importLegacyVideos(videos){
    const current=this.ctx.storage.kv.get("content");
    if(!current)return {error:"Content store is not ready."};
    const data=structuredClone(current.data);
    const existing=data.videos||[];
    const ids=new Set(existing.map(v=>{try{const u=new URL(v.url);return u.searchParams.get("v")||u.pathname.split("/").pop()}catch{return ""}}));
    let added=0;
    for(const video of videos){
      const id=video.url.match(/[?&]v=([\w-]{11})/i)?.[1];
      if(!id||ids.has(id))continue;
      existing.push({title:video.title||"Archived live performance",url:"https://www.youtube.com/watch?v="+id});
      ids.add(id);added++;
    }
    if(added){
      data.videos=existing;
      const next={...current,sha:crypto.randomUUID(),data};
      this.ctx.storage.kv.put("content",next);
    }
    return {imported:added,total:existing.length};
  }
  save(expectedSha,data){
    const current=this.ctx.storage.kv.get("content");
    if(!current)return {error:"Content has not been initialized. Reload the admin page."};
    if(current.sha!==expectedSha)return {error:"Another editor changed the site. Reload before publishing to avoid overwriting their changes."};
    const next={...current,sha:crypto.randomUUID(),data,updatedAt:Date.now()};
    this.ctx.storage.kv.put("content",next);
    return {ok:true,sha:next.sha};
  }
}
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export default {
 async fetch(request,env,ctx){
   const url=new URL(request.url),path=url.pathname;
   if(path==="/api/health"){
     return request.method==="GET"?respond({ok:true,service:"i90sdet-worker",revision:"history-v2",storage:env.BAND_CONTENT?"available":"binding-missing"}):respond({error:"Method not allowed"},405);
   }
   if(path==="/api/admin/content")return contentHandler({request,env,ctx});
   if(path==="/api/admin/import")return importHandler({request,env,ctx});
   if(path.startsWith("/api/"))return respond({error:"API route not found"},404);
   if(path==="/content.json"){
     if(request.method!=="GET"&&request.method!=="HEAD")return respond({error:"Method not allowed"},405);
     if(!env.BAND_CONTENT)return respond({error:"Site data store unavailable"},503);
     try{
       const seedResponse=await env.ASSETS.fetch(new Request(new URL("/content.json",request.url)));
       const seed=seedResponse.ok?await seedResponse.json():null;
       const store=env.BAND_CONTENT.getByName("interstate90s-content");
       const saved=seed?await store.mergeSeed(seed):await store.getSnapshot();
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
