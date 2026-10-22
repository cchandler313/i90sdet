import { onRequest as contentHandler } from "./functions/api/admin/content.js";
const apiJson=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname==="/api/health")return request.method==="GET"?apiJson({ok:true,service:"i90sdet-worker",message:"Worker API routes active",revision:"auth-fix-20261022-b"}):apiJson({error:"Method not allowed"},405);
  if(url.pathname==="/api/admin/content")return contentHandler({request,env,ctx});
  if(url.pathname.startsWith("/api/"))return apiJson({error:"API route not found"},404);
  if(!env.ASSETS)return apiJson({error:"Static assets binding missing. Verify wrangler.jsonc assets.directory."},503);
  if(url.pathname==="/admin")return Response.redirect(url.origin+"/admin/",308);
  return env.ASSETS.fetch(request);
 }
};
