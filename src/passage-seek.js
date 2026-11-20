// A range event commits one passage jump. Never apply a drag to a replacement queue.
export function passageSeek(input, owner, commit, trustedOnly = false) {
  let active = false, start, moved = false, cancelled = false;
  const begin = event => {
    if (trustedOnly && !event.isTrusted) return;
    if (!active || event.type==='pointerdown') { active=true; start=owner(); moved=false; cancelled=false; }
    if(event.type==='input')moved=true;
  };
  input.addEventListener('pointerdown',begin); input.addEventListener('input',begin);
  const cancel = () => { if(active){active=false;cancelled=true;} };
  input.addEventListener('blur',cancel); input.addEventListener('pointercancel',cancel);
  input.addEventListener('pointerup',()=>{ if(!moved)active=false; });
  input.addEventListener('change',event=>{
    if (trustedOnly && !event.isTrusted) return;
    const ok=!input.disabled && !cancelled && (!active || start===owner());
    active=false; cancelled=false; if(ok)commit(Number(input.value));
  });
  return (index,count)=>{
    if(active && start!==owner())cancelled=true;
    input.max=String(Math.max(0,count-1));input.disabled=!count;
    if(!active || cancelled)input.value=String(Math.max(0,Math.min(index,count-1)));
  };
}
