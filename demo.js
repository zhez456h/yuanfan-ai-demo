/* Static, read-only adapter. The interface and displayed content come from the original project. */
(() => {
  const script = document.currentScript;
  const root = new URL('./', script.src);
  window.demoRoot = root;
  window.demoNotice = (message = '这是原项目的静态演示，登录、下单、发送和实时 AI 调用不会执行。') => {
    let box = document.getElementById('static-demo-message');
    if (!box) { box = document.createElement('div'); box.id = 'static-demo-message'; box.setAttribute('role','status'); document.body.append(box); }
    box.textContent = message; box.hidden = false; clearTimeout(box.timer); box.timer = setTimeout(() => box.hidden = true, 6500);
  };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, options={}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const method = (options.method || input.method || 'GET').toUpperCase();
    if (url.origin !== location.origin || method !== 'GET' || /\/api(?:\/|$)/.test(url.pathname)) {
      return new Response(JSON.stringify({detail:'静态演示：后台操作不执行',error:'静态演示：后台操作不执行'}), {status:503,headers:{'Content-Type':'application/json'}});
    }
    return nativeFetch(input, options);
  };
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = '#static-demo-badge{position:fixed;bottom:10px;right:12px;z-index:2147483000;border:1px solid #ccd5df;border-radius:18px;background:#fffffff2;color:#43536a;padding:6px 12px;font:12px/1.5 system-ui;box-shadow:0 2px 9px #0001;cursor:pointer}#static-demo-message{position:fixed;bottom:52px;right:16px;max-width:min(460px,90vw);padding:14px 18px;background:#172b42;color:#fff;border-radius:10px;z-index:2147483001;font:14px/1.7 system-ui;box-shadow:0 6px 30px #0003}#static-demo-message[hidden]{display:none}@media print{#static-demo-badge,#static-demo-message{display:none}}';
    document.head.append(style);
    const badge = document.createElement('button'); badge.id='static-demo-badge'; badge.type='button'; badge.textContent='静态演示 · 后台操作不执行'; badge.onclick=()=>window.demoNotice(); document.body.append(badge);
    document.querySelectorAll('input[type=password]').forEach(x=>{x.value='';x.autocomplete='off';});
  });
})();
