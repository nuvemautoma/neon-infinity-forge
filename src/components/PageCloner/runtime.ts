/**
 * Runtime JS embutido no export final. Mantém-se pequeno (~1.5KB).
 * Procura elementos com [data-anim] e [data-action] e ativa as animações.
 */
export const RUNTIME_JS = `
(function(){
  function smoothTo(el){
    if(!el) return;
    el.scrollIntoView({behavior:'smooth',block:'start'});
  }
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-action]');
    if(!t) return;
    var a = t.getAttribute('data-action');
    if(a === 'scroll-anchor'){
      e.preventDefault();
      var sel = t.getAttribute('data-target') || '';
      if(sel) smoothTo(document.querySelector(sel));
    } else if(a === 'scroll-top'){
      e.preventDefault(); window.scrollTo({top:0,behavior:'smooth'});
    } else if(a === 'scroll-bottom'){
      e.preventDefault(); window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});
    }
  });
  // Fade/slide on scroll
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('pcl-anim-in'); io.unobserve(en.target); }
      });
    },{threshold:0.12});
    document.querySelectorAll('[data-anim]').forEach(function(el){ io.observe(el); });
  }
  // Parallax
  function px(){
    document.querySelectorAll('[data-parallax]').forEach(function(el){
      var r = el.getBoundingClientRect();
      var off = (window.innerHeight - r.top) * 0.15;
      el.style.backgroundPosition = 'center ' + (-off) + 'px';
    });
  }
  window.addEventListener('scroll', px, {passive:true});
  px();
})();
`;

export const RUNTIME_CSS = `
[data-anim]{opacity:0;transform:translateY(24px);transition:opacity .8s ease,transform .8s ease;}
[data-anim="fade"]{transform:none;}
[data-anim].pcl-anim-in{opacity:1;transform:none;}
[data-parallax]{background-attachment:fixed;background-size:cover;background-position:center;}
.pcl-btn{display:inline-block;padding:12px 24px;border-radius:10px;border:0;cursor:pointer;font-weight:600;text-decoration:none;}
.pcl-fx-pulse{animation:pclPulse 2s infinite;}
@keyframes pclPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.05);}}
.pcl-fx-glow{box-shadow:0 0 0 0 currentColor;animation:pclGlow 1.8s infinite;}
@keyframes pclGlow{0%{box-shadow:0 0 0 0 rgba(0,180,255,.6);}70%{box-shadow:0 0 0 18px rgba(0,180,255,0);}100%{box-shadow:0 0 0 0 rgba(0,180,255,0);}}
.pcl-fx-shine{position:relative;overflow:hidden;}
.pcl-fx-shine::after{content:"";position:absolute;top:0;left:-75%;width:50%;height:100%;background:linear-gradient(120deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-20deg);animation:pclShine 2.5s infinite;}
@keyframes pclShine{0%{left:-75%;}60%,100%{left:125%;}}
`;
