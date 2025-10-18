
(function(){
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try{
    var obs=new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('ae-in'); obs.unobserve(e.target);} });
    },{threshold:0.12});
    document.querySelectorAll('.ae-reveal').forEach(function(el){ obs.observe(el); });
  }catch(e){}
})();
