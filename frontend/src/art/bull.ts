import * as T from "three";

type Point = [number, number, number];
const vec = (p: Point) => new T.Vector3(...p);
const metal = (color: string) => new T.MeshStandardMaterial({
  color, flatShading: true, metalness: 0.32, roughness: 0.44, side: T.DoubleSide
});

export function sculptBull() {
  const root = new T.Group();
  const hide = metal("#b27a42"), mane = metal("#947048"), horn = metal("#ffdfa0");
  const hoof = metal("#463b31"), nose = metal("#866142"), eye = metal("#151b18");
  function oval(parent: T.Group, position: Point, size: Point, material = hide, tilt = 0) {
    const mesh = new T.Mesh(new T.IcosahedronGeometry(1, 1), material);
    mesh.position.set(...position); mesh.scale.set(...size); mesh.rotation.z = tilt;
    parent.add(mesh);
    return mesh;
  }
  // Sweep tapered elliptical sections through a space curve. The changing radii
  // form the shoulders, knuckles and horn tips directly in the silhouette.
  function sweep(parent: T.Group, path: Point[], radii: [number, number][], material = hide, sides = 9) {
    const points = path.map(vec);
    const positions: number[] = [], indices: number[] = [];
    let lateral = new T.Vector3(0, 0, 1);
    for (let i = 0; i < points.length; i++) {
      const tangent = points[Math.min(i + 1, points.length - 1)].clone().sub(points[Math.max(i - 1, 0)]).normalize();
      lateral.addScaledVector(tangent, -lateral.dot(tangent)).normalize();
      const normal = tangent.clone().cross(lateral);
      for (let j = 0; j < sides; j++) {
        const angle = j / sides * Math.PI * 2;
        const p = points[i].clone().addScaledVector(lateral, Math.cos(angle) * radii[i][0])
          .addScaledVector(normal, Math.sin(angle) * radii[i][1]);
        positions.push(p.x, p.y, p.z);
        if (i) {
          const a = (i - 1) * sides + j, b = (i - 1) * sides + (j + 1) % sides;
          indices.push(a,b,a+sides,b,b+sides,a+sides);
        }
      }
    }
    for (let j = 1; j < sides - 1; j++) {
      const end = (points.length - 1) * sides;
      indices.push(0,j+1,j,end,end+j,end+j+1);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    parent.add(new T.Mesh(geometry, material));
  }

  sweep(root, [[-1.16,1.4,0],[-.88,1.49,0],[-.52,1.54,0],[.02,1.43,0],[.54,1.44,0],[.94,1.44,0],[1.25,1.43,0],[1.39,1.47,0]],
    [[.25,.39],[.51,.77],[.57,.75],[.51,.57],[.41,.46],[.5,.56],[.41,.46],[.19,.26]],hide,14);
  const head = new T.Group(); head.position.set(-.83,1.52,0); root.add(head);
  sweep(head, [[.15,.12,0],[-.25,.03,0],[-.53,-.1,0],[-.77,-.14,0],[-.96,-.31,0],[-1.22,-.43,0]],
    [[.42,.49],[.48,.52],[.35,.38],[.39,.37],[.29,.28],[.22,.17]],mane,12);
  oval(head,[-1.22,-.44,0],[.21,.18,.28],nose,-.22);
  for (const side of [-1,1]) {
    const z = (v: number) => side * v;
    sweep(head,[[-.66,.09,z(.24)],[-.72,.15,z(.45)],[-.82,.25,z(.65)],[-.95,.42,z(.77)],[-1.12,.59,z(.81)],[-1.24,.71,z(.79)]],
      [[.13,.15],[.145,.146],[.109,.109],[.075,.075],[.038,.038],[.006,.006]],horn);
    sweep(head,[[-.54,-.045,z(.25)],[-.41,-.05,z(.45)],[-.3,.01,z(.59)]],[[.09,.09],[.105,.1],[.012,.018]],mane);
    oval(head,[-.91,-.16,z(.307)],[.069,.045,.032],eye,-.2);
    oval(head,[-.9,-.1,z(.30)],[.12,.052,.056],hide,-.32);
    oval(head,[-1.355,-.405,z(.16)],[.033,.038,.031],eye);
  }

  const legs: {hip:T.Group; knee:T.Group; rear:boolean; side:number}[] = [];
  for (const rear of [false,true]) for (const side of [-1,1]) {
    const hip = new T.Group(), knee = new T.Group();
    hip.position.set(rear ? .94 : -.66,1.43,side*.32);
    root.add(hip); hip.add(knee);
    const bend = rear ? -.25 : .1;
    sweep(hip,[[0,.22,0],[.015,-.01,side*.045],[bend*.55,-.34,side*.03],[bend,-.58,0]],
      [[.19,.26],[.24,.35],[.18,.24],[.115,.128]]);
    knee.position.set(bend,-.58,0);
    const hock = rear ? .32 : .015;
    sweep(knee,[[0,.045,0],[hock*.65,-.23,0],[hock,-.39,0],[hock-.065,-.62,0],[hock-.12,-.72,0]],
      [[.116,.124],[.105,.104],[.093,.091],[.058,.07],[.083,.095]]);
    oval(knee,[hock-.154,-.755,0],[.135,.08,.106],hoof,-.15);
    legs.push({hip,knee,rear,side});
  }
  const tail = new T.Group(); tail.position.set(1.24,1.64,0); root.add(tail);
  sweep(tail,[[0,0,0],[.24,.03,-.01],[.44,.2,-.04],[.59,.47,-.02],[.79,.6,.06],[.99,.58,.14]],
    [[.084,.084],[.065,.065],[.05,.05],[.04,.04],[.035,.035],[.028,.028]]);
  oval(tail,[1.03,.54,.15],[.14,.065,.055],mane,-.38);

  function pose(time: number) {
    const phase = time * 4.8;
    root.rotation.z = -.018 + .054 * Math.sin(phase);
    root.position.y = .075 * Math.cos(phase * 2);
    head.rotation.z = .09 + .08 * Math.cos(phase - .45);
    tail.rotation.z = .17 * Math.sin(phase - .9);
    for (const {hip,knee,rear,side} of legs) {
      const step = phase + (rear ? 2.7 : 0) + (side === 1 ? 0 : 1.4);
      hip.rotation.z = .62 * Math.sin(step) + (rear ? .15 : -.14);
      knee.rotation.z = (rear ? .63 : .74) * (.5 + .5 * Math.cos(step)) + (rear ? -.2 : .07);
    }
  }
  pose(.92);
  return {root,pose};
}

export function bullCamera(aspect: number) {
  const height = Math.max(3.05, 5.2/aspect);
  const cam = new T.OrthographicCamera(-height*aspect/2,height*aspect/2,height/2,-height/2,.1,40);
  cam.position.set(-4.3,3.05,9.6); cam.lookAt(0,1.2,0); cam.updateMatrixWorld();
  return cam;
}
