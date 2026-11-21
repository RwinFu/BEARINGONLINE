// All requests go directly from the browser to GitHub. The credential is never persisted.
const GitHubStore = (() => {
  let token = '', repo = '', branch = '';
  const root = 'https://api.github.com';
  function bytesTo64(bytes) { let str=''; for(let i=0;i<bytes.length;i+=0x8000) str+=String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(str); }
  function utf8To64(str) { return bytesTo64(new TextEncoder().encode(str)); }
  function from64(str) { const raw=atob(str.replace(/\s/g,'')); const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)); return new TextDecoder().decode(bytes); }
  async function call(path,options={}) {
    const response=await fetch(root+path,{...options,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:`Bearer ${token}`,...options.headers}});
    if(!response.ok){ if(response.status===409||response.status===422) throw Error('این درخواست هم‌زمان تغییر کرده است؛ تغییرات خود را کپی کنید، فهرست را به‌روز کنید و دوباره امتحان کنید.'); if(response.status===401||response.status===403) throw Error('دسترسی GitHub نامعتبر است یا مجوز کافی ندارد.'); throw Error(`ارتباط با GitHub ناموفق بود (کد ${response.status}).`); }
    return response.json();
  }
  async function checkPrivate(){const info=await call(`/repos/${repo}`);if(!info.private)throw Error('برای امنیت اطلاعات، مخزن داده‌ها باید خصوصی باشد.');if(!info.permissions?.push)throw Error('دسترسی نوشتن به مخزن لازم است.');return info;}
  async function connect(name,credential){ if(!/^[\w.-]+\/[\w.-]+$/.test(name))throw Error('نام مخزن را به شکل owner/repository وارد کنید.');if(name.toLowerCase()==='rwinfu/bearingonline')throw Error('لطفاً برای اطلاعات مشتریان یک مخزن خصوصی جدا از مخزن کد ایجاد کنید.');repo=name;token=credential;try{const info=await checkPrivate();branch=info.default_branch;await call(`/repos/${repo}/branches/${encodeURIComponent(branch)}`);}catch(e){token='';repo='';branch='';throw e;} }
  function logout(){token='';repo='';branch='';}
  async function list(){const tree=await call(`/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);if(tree.truncated)throw Error('فهرست مخزن بیش از حد بزرگ است و کامل دریافت نشد.');const files=tree.tree.filter(x=>x.type==='blob'&&/^requests\/[a-f0-9-]+\.json$/.test(x.path)); const results=[];for(let i=0;i<files.length;i+=6){const batch=await Promise.all(files.slice(i,i+6).map(async file=>{const blob=await call(`/repos/${repo}/git/blobs/${file.sha}`);try{const data=JSON.parse(from64(blob.content));if(!/^[a-f0-9-]+$/.test(data.id || '') || file.path!==`requests/${data.id}.json` || !Array.isArray(data.items) || !Array.isArray(data.followups))throw Error();return {...data,_sha:file.sha};}catch{throw Error(`خواندن فایل ${file.path} ناموفق بود؛ اطلاعات را بررسی کنید.`);}}));results.push(...batch);}return results.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));}
  async function save(record){await checkPrivate();const {_sha,...data}=record;const path=`requests/${data.id}.json`;const result=await call(`/repos/${repo}/contents/${path}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Update customer request',content:utf8To64(JSON.stringify(data,null,2)),branch,...(_sha?{sha:_sha}:{})})});return {...data,_sha:result.content.sha};}
  return {connect,logout,list,save,bytesTo64};
})();
