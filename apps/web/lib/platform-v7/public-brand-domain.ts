export const PUBLIC_BRAND_HOST = 'процент-агро.рф';
export const PUBLIC_ASCII_HOST = 'xn----8sbjf4befbjgs9b.xn--p1ai';
export const PUBLIC_BRAND_ORIGIN = `https://${PUBLIC_BRAND_HOST}`;
export const PUBLIC_ASCII_ORIGIN = `https://${PUBLIC_ASCII_HOST}`;

const PUBLIC_HOSTS = new Set([PUBLIC_ASCII_HOST, PUBLIC_BRAND_HOST]);

export function normalizePublicBrandText(value: string): string {
  return value
    .replaceAll(PUBLIC_ASCII_ORIGIN, PUBLIC_BRAND_ORIGIN)
    .replaceAll(PUBLIC_ASCII_HOST, PUBLIC_BRAND_HOST);
}

export function toPublicBrandUrl(value: string | URL): string {
  const raw = typeof value === 'string' ? value : value.toString();

  try {
    const parsed = new URL(raw, PUBLIC_ASCII_ORIGIN);
    if (!PUBLIC_HOSTS.has(parsed.hostname.toLowerCase())) return raw;
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${parsed.protocol}//${PUBLIC_BRAND_HOST}${port}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return normalizePublicBrandText(raw);
  }
}

export function publicBrandUrl(pathname = '/', search = '', hash = ''): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${PUBLIC_BRAND_ORIGIN}${normalizedPath}${search}${hash}`;
}

export function buildPublicBrandRuntimeScript(): string {
  return `(function(){
    var ascii=${JSON.stringify(PUBLIC_ASCII_HOST)};
    var brand=${JSON.stringify(PUBLIC_BRAND_HOST)};
    var asciiOrigin='https://'+ascii;
    var brandOrigin='https://'+brand;
    function normalize(value){
      if(typeof value!=='string')return value;
      return value.split(asciiOrigin).join(brandOrigin).split(ascii).join(brand);
    }
    function currentBrandUrl(){
      return brandOrigin+window.location.pathname+window.location.search+window.location.hash;
    }
    function normalizeElement(element){
      if(!element||element.nodeType!==1)return;
      var targets=[];
      if(element.matches&&element.matches('a[href],link[href],meta[content]'))targets.push(element);
      if(element.querySelectorAll)targets=targets.concat(Array.prototype.slice.call(element.querySelectorAll('a[href],link[href],meta[content]')));
      targets.forEach(function(target){
        var attribute=target.hasAttribute('href')?'href':'content';
        var value=target.getAttribute(attribute);
        if(value&&value.indexOf(ascii)!==-1)target.setAttribute(attribute,normalize(value));
      });
    }
    function enforceAddress(){
      try{
        if(window.location.hostname===ascii){
          window.history.replaceState(window.history.state,'',currentBrandUrl());
        }
      }catch(error){}
    }
    enforceAddress();
    normalizeElement(document.documentElement);
    try{
      var observer=new MutationObserver(function(records){
        records.forEach(function(record){
          if(record.type==='attributes')normalizeElement(record.target);
          Array.prototype.forEach.call(record.addedNodes||[],normalizeElement);
        });
      });
      observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href','content']});
    }catch(error){}
    document.addEventListener('copy',function(event){
      try{
        var selected=window.getSelection?String(window.getSelection()||''):'';
        var normalized=normalize(selected);
        if(normalized!==selected&&event.clipboardData){
          event.preventDefault();
          event.clipboardData.setData('text/plain',normalized);
        }
      }catch(error){}
    },true);
    try{
      var clipboard=navigator.clipboard;
      var originalWrite=clipboard&&clipboard.writeText&&clipboard.writeText.bind(clipboard);
      if(originalWrite)clipboard.writeText=function(text){return originalWrite(normalize(String(text)));};
    }catch(error){}
    try{
      var originalShare=navigator.share&&navigator.share.bind(navigator);
      if(originalShare)navigator.share=function(data){
        var next=Object.assign({},data||{});
        if(typeof next.url==='string')next.url=normalize(next.url);
        return originalShare(next);
      };
    }catch(error){}
    window.addEventListener('pageshow',enforceAddress);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')enforceAddress();});
  })();`;
}
