import * as T from "three";
import { bullCamera, sculptBull } from "./bull";

export function animateBull(host: HTMLElement, paused: {current:boolean}) {
  const renderer = new T.WebGLRenderer({alpha:true, antialias:true, powerPreference:"low-power"});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  const scene = new T.Scene(), {root,pose} = sculptBull();
  scene.add(root, new T.HemisphereLight(0xffe5b3, 0x526e63, 1.65));
  for (const [x,y,z,color,power] of [[-4,7,5,0xffe5c5,3],[4,3,-3,0xffc475,4],[-3,1,-4,0x8edac0,1.7]]) {
    const light = new T.DirectionalLight(color,power);
    light.position.set(x,y,z); scene.add(light);
  }
  let camera = bullCamera(1), handle = 0, time = .92, last = 0, visible = true;
  host.appendChild(renderer.domElement);
  const draw = () => renderer.render(scene,camera);
  const resize = new ResizeObserver(() => {
    const {clientWidth:w,clientHeight:h} = host;
    if (w && h) { renderer.setSize(w,h,false); camera = bullCamera(w/h); draw(); }
  });
  function tick(now:number) {
    handle = 0;
    if (!visible || document.hidden || paused.current) return;
    if (now-last >= 1000/30) {
      time += Math.min((now-last)/1000,.05); pose(time); draw(); last = now;
    }
    handle = requestAnimationFrame(tick);
  }
  const resume = () => { if (!handle && visible && !document.hidden && !paused.current) handle = requestAnimationFrame(tick); };
  const observer = new IntersectionObserver(([entry]) => {visible = entry.isIntersecting; resume();});
  observer.observe(host); resize.observe(host); document.addEventListener("visibilitychange",resume);
  function onLoss(e:Event) { e.preventDefault(); visible=false; renderer.domElement.style.opacity="0"; }
  renderer.domElement.addEventListener("webglcontextlost",onLoss);
  resume();
  return {resume, dispose() {
    cancelAnimationFrame(handle); resize.disconnect(); observer.disconnect();
    document.removeEventListener("visibilitychange",resume);
    renderer.domElement.removeEventListener("webglcontextlost",onLoss);
    const materials = new Set<T.Material>();
    root.traverse(part => { if(part instanceof T.Mesh) { part.geometry.dispose(); materials.add(part.material); } });
    materials.forEach(material => material.dispose());
    renderer.dispose(); renderer.domElement.remove();
  }};
}
