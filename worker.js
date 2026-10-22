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
      current={sha:crypto.randomUUID(),data,seedTag:"event-details-20261022-v4"};
      this.ctx.storage.kv.put("content",current);
    }
    return current;
  }
  mergeSeed(seed){
    let current=this.ctx.storage.kv.get("content");
    if(!current)return this.initialize(seed);
    if(current.seedTag==="event-details-20261022-v4")return current;
    const existing=structuredClone(current.data);
    const uniqueEvents=(first,second)=>{
      const m=new Map();
      for(const event of [...first,...second]){
        if(!event||!event.date||!event.venue)continue;
        const key=event.date+"|"+event.venue.toLowerCase().replace(/[^a-z0-9]/g,"");
        if(!m.has(key))m.set(key,event);
        else {
          const edited=m.get(key);
          m.set(key,{...event,...edited,
            description:edited.description||event.description||"",
            image:edited.image||event.image||"",
            imageAlt:edited.imageAlt||event.imageAlt||"",
            imageKey:edited.imageKey||event.imageKey||"",
            sourceUrl:edited.sourceUrl||event.sourceUrl||"",
            details:edited.details||event.details||undefined,
            admission:edited.admission||event.admission||""});
          if(typeof edited.url==="string"&&/^https:\/\/(?:www\.)?interstate90sdet\.com\//.test(edited.url))delete m.get(key).url;
        }
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

    current={...current,sha:crypto.randomUUID(),data:existing,seedTag:"event-details-20261022-v4"};
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
  eventPhotoSource(key){
    const current=this.ctx.storage.kv.get("content");
    const event=current?.data?.upcomingShows?.find(e=>e.imageKey===key)||
      current?.data?.recentShows?.find(e=>e.imageKey===key);
    if(!event||typeof event.image!=="string")return null;
    try{
      const url=new URL(event.image);
      if(url.protocol!=="https:"||!["interstate90sdet.com","www.interstate90sdet.com"].includes(url.hostname)||!url.pathname.startsWith("/wp-content/uploads/"))return null;
      return url.href;
    }catch{return null}
  }
  getEventMedia(key){
    const meta=this.ctx.storage.kv.get("eventmedia:"+key+":meta");
    if(!meta||meta.parts>100||meta.parts<1)return null;
    const bytes=new Uint8Array(meta.length),chunkSize=384*1024;
    for(let i=0;i<meta.parts;i++){
      const chunk=this.ctx.storage.kv.get("eventmedia:"+key+":chunk:"+i);
      if(!(chunk instanceof Uint8Array))return null;
      bytes.set(chunk,i*chunkSize);
    }
    return {contentType:meta.contentType,bytes};
  }
  saveEventMedia(key,bytes,contentType){
    if(!(bytes instanceof Uint8Array)||bytes.length>24*1024*1024||bytes.length<100)return false;
    if(!/^image\/(?:png|jpeg|webp|gif)$/.test(contentType))return false;
    const chunkSize=384*1024,parts=Math.ceil(bytes.length/chunkSize);
    for(let i=0;i<parts;i++)this.ctx.storage.kv.put("eventmedia:"+key+":chunk:"+i,bytes.slice(i*chunkSize,(i+1)*chunkSize));
    this.ctx.storage.kv.put("eventmedia:"+key+":meta",{contentType,length:bytes.length,parts});
    return true;
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
     return request.method==="GET"?respond({ok:true,service:"i90sdet-worker",revision:"event-details-v4",storage:env.BAND_CONTENT?"available":"binding-missing"}):respond({error:"Method not allowed"},405);
   }
   if(path==="/api/admin/content")return contentHandler({request,env,ctx});
   if(path==="/api/admin/import")return importHandler({request,env,ctx});
   if(path.startsWith("/event-media/")){
     if(request.method!=="GET"&&request.method!=="HEAD")return respond({error:"Method not allowed"},405);
     const key=path.slice("/event-media/".length);
     if(!/^[a-z0-9-]{3,95}$/.test(key)||!env.BAND_CONTENT)return respond({error:"Photo not found"},404);
     try{
       const store=env.BAND_CONTENT.getByName("interstate90s-content");
       const photo=await store.getEventMedia(key);
       const headers={"cache-control":"public, max-age=86400","x-content-type-options":"nosniff"};
       if(photo){
         headers["content-type"]=photo.contentType;
         headers["x-i90s-photo-cache"]="stored";
         return new Response(request.method==="HEAD"?null:photo.bytes,{headers});
       }
       const source=await store.eventPhotoSource(key);
       if(!source)return respond({error:"Photo not yet imported"},404);
       const response=await fetch(source,{redirect:"error"});
       const contentType=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
       if(!response.ok||!/^image\/(?:png|jpeg|webp|gif)$/.test(contentType))return respond({error:"Original photo unavailable for migration"},502);
       const len=Number(response.headers.get("content-length")||0);
       if(len>24*1024*1024)return respond({error:"Original image exceeds migration size limit"},413);
       const body=new Uint8Array(await response.arrayBuffer());
       if(body.length>24*1024*1024)return respond({error:"Original image exceeds migration size limit"},413);
       const persisted=await store.saveEventMedia(key,body,contentType);
       if(!persisted)return respond({error:"Unable to store photo"},503);
       return new Response(request.method==="HEAD"?null:body,{headers:{...headers,"content-type":contentType,"x-i90s-photo-cache":"imported"}});
     }catch{return respond({error:"Unable to retrieve event photo"},503)}
   }
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
