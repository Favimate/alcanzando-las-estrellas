(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  function $(sel, ctx){return Array.prototype.slice.call((ctx||document).querySelectorAll(sel));}

  // Auto-apply ae-reveal to common elements if not present
  var autoSelectors = [
    '.hero .hero-content',
    '.cards .card',
    '.feature-item img',
    '.feature-item div',
    '.gallery .tile',
    '.contact-list li',
    '.map-block',
    '.promo'
  ];
  autoSelectors.forEach(function(sel){ $(sel).forEach(function(el){ el.classList.add('ae-reveal'); }); });

  // Mark groups for stagger
  $('.cards, .feature-item, .contact-list, .grid').forEach(function(group){
    group.classList.add('stagger');
  });

  try{
    var i = 0;
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          var el = e.target;
          // Stagger children if group
          if (el.classList.contains('stagger')) {
            var delay = 0;
            $( ':scope > *', el ).forEach(function(child){
              child.style.transitionDelay = (delay/1000)+'s';
              delay += 90; // 90ms step
              child.classList.add('ae-reveal','ae-in');
            });
            el.classList.add('ae-in');
          } else {
            // add a slight random delay for variety
            el.style.transitionDelay = ((i%5)*60/1000)+'s';
            el.classList.add('ae-in');
            i++;
          }
          obs.unobserve(el);
        }
      });
    }, {threshold: 0.12});

    // Observe revealables and groups
    $('.ae-reveal, .stagger').forEach(function(el){ obs.observe(el); });
  }catch(e){ /* no-op */ }
})();