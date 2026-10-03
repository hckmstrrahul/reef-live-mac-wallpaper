export const PLANET_FISH_PATTERNS = [
  "Halo rings",
  "Flowing channels",
  "Constellations",
  "Branching veins",
  "Luminous scales",
  "Broken saddles",
  "Comet trails",
  "Opal islands",
];

// Keep seven familiar animals; change the other 37, including the small shoal.
// Individual assignments prevent a shared daytime skin from cloning alien marks.
export function planetFishPattern(index) {
  const style = [1, 4, 17, 32].includes(index)
    ? 0
    : [8, 11, 23].includes(index)
      ? 1
      : 2 + ((index * 5 + Math.floor(index / 6)) % 6);
  return {
    style,
    name: PLANET_FISH_PATTERNS[style],
    seed: (index * 0.61803398875 + 0.17) % 1,
  };
}

// Analytic markings attached to undeformed skin. Each fish executes one uniform
// branch, with no new textures, geometry, passes or per-frame CPU work.
export const planetFishGLSL = `
float pfHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float pfNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(pfHash(i),pfHash(i+vec2(1.,0.)),f.x),mix(pfHash(i+vec2(0.,1.)),pfHash(i+vec2(1.)),f.x),f.y);
}
float pfLine(float d,float width){return 1.-smoothstep(width,width+max(.007,fwidth(d)*.8),abs(d));}
vec3 planetFishGlow(vec3 p,float style,float seed,float species,float time,float view,vec3 primary,vec3 secondary){
 float anatomy=(1.-smoothstep(.72,1.04,abs(p.x)))*(1.-smoothstep(.30,.48,abs(p.y)));
 float flank=smoothstep(-.78,-.50,p.x)*(1.-smoothstep(.60,.92,p.x));
 float phase=seed*6.2831;
 float pulse=.70+.30*sin(time*.72+phase-p.x*3.);
 float mask=0.,accent=0.;
 vec2 uv=p.xy;
 if(style<.5){
   // Original staggered rings, retained on a small number of fish.
   vec2 q=uv*vec2(9.,16.);q.x+=mod(floor(q.y),2.)*.5;
   vec2 cell=floor(q),local=fract(q)-.5;
   float rnd=fract(sin(dot(cell,vec2(127.1,311.7))+species)*43758.5453);
   float radius=length(local*vec2(1.,.88));
   mask=(1.-smoothstep(.022,.045+max(.012,fwidth(radius)),abs(radius-(.21+rnd*.065))))*smoothstep(.12,.4,rnd);
   pulse=.60+.40*pow(.5+.5*sin(time*1.1-p.x*5.+rnd*6.28),3.);
 }else if(style<1.5){
   vec3 q=p*vec3(3.5,3.,2.);
   float field=q.y*2.7+sin(q.x*3.1+sin(q.z*2.3))*1.25+sin(q.z*4.3+q.x)*.65;
   float line=abs(sin(field*3.14159));
   mask=1.-smoothstep(.055,.11+max(.025,fwidth(line)*.65),line);
 }else if(style<2.5){
   // Sparse bright stars in an irregular dust cloud; no circular outlines.
   vec2 q=uv*vec2(10.,19.)+seed*7.,cell=floor(q);
   float rnd=pfHash(cell+phase);
   vec2 offset=vec2(rnd,pfHash(cell+19.))-.5;
   vec2 local=fract(q)-.5-offset*.48;
   float radius=length(local);
   float star=1.-smoothstep(.038,.065+fwidth(radius),radius);
   mask=star*step(.35,rnd);
   accent=(pfLine(local.x,.012)*pfLine(local.y,.16)+pfLine(local.y,.012)*pfLine(local.x,.12))*step(.88,rnd)*.45;
   pulse=.45+.55*pow(.5+.5*sin(time*.85+rnd*12.),2.);
   mask*=flank;accent*=flank;
 }else if(style<3.5){
   // A single meandering lateral nerve with bifurcating fine branches.
   float trunk=.035*sin(uv.x*7.+phase)+.012*sin(uv.x*23.);
   float y=uv.y-trunk;
   float reach=smoothstep(.025,.09,abs(y))*(1.-smoothstep(.13,.27,abs(y)));
   float branch=fract((uv.x+abs(y)*.85)*5.5+seed)-.5;
   float fork=fract((uv.x-abs(y)*.55)*11.+seed)-.5;
   mask=(pfLine(y,.009)+pfLine(branch,.032)*reach*.72)*flank;
   accent=pfLine(fork,.018)*reach*smoothstep(.07,.15,abs(y))*flank*.45;
   pulse=.52+.48*pow(.5+.5*sin(uv.x*7.-time*1.2+phase),3.);
 }else if(style<4.5){
   // Overlapping scalloped scales, concentrated on the upper flank.
   vec2 q=uv*vec2(7.5,12.);q.x+=mod(floor(q.y),2.)*.5;
   vec2 local=fract(q)-vec2(.5,.03);
   float rnd=pfHash(floor(q)+seed*8.);
   float arc=length(local*vec2(1.,.85))-.47;
   float scales=pfLine(arc,.025)*smoothstep(.10,.26,local.y);
   mask=scales*flank*smoothstep(-.20,.06,uv.y)*(.3+.7*rnd);
   accent=mask*smoothstep(.68,.98,rnd);
   pulse=.7+.3*sin(time*.6+uv.x*4.+phase+view*3.);
 }else if(style<5.5){
   // Broad, broken oblique saddles: a few large marks, not a fine stripe grid.
   float q=uv.x*4.2+uv.y*.85+seed;
   float rnd=pfHash(vec2(floor(q),seed*9.));
   float band=pfLine(fract(q)-.5,.105+.055*rnd);
   float gap=1.-smoothstep(.024,.067,abs(uv.y-.055*sin(uv.x*8.+phase)));
   mask=band*(1.-gap)*flank*(.58+.42*smoothstep(-.05,.2,uv.y));
   accent=band*pfLine(uv.y+.14,.016)*flank;
 }else if(style<6.5){
   // Asymmetric tapered streaks with bright heads and long, dim tails.
   vec2 q=vec2(uv.x*5.2+uv.y*2.,uv.y*11.);
   q.x+=floor(q.y)*.37+seed*4.;
   vec2 local=fract(q);float rnd=pfHash(floor(q)+phase);
   float taper=(1.-smoothstep(.04,.9,local.x));
   float streak=pfLine(local.y-.5,.024+.035*taper)*taper;
   mask=streak*step(.28,rnd)*flank;
   accent=(1.-smoothstep(.045,.10,length((local-vec2(.1,.5))*vec2(1.,1.4))))*step(.28,rnd)*flank;
   pulse=.55+.45*sin(time*.9-rnd*8.+phase)*sin(time*.9-rnd*8.+phase);
 }else{
   // Broad opalescent pools with soft colored interiors and irregular edges.
   vec2 q=uv*vec2(5.5,8.)+seed*13.;
   float field=pfNoise(q+vec2(sin(q.y)*.3,cos(q.x)*.3));
   float edge=pfLine(field-.60,.025);
   mask=(smoothstep(.56,.76,field)*.30+edge*.44)*flank;
   accent=smoothstep(.68,.84,field)*flank*.48;
   pulse=.65+.35*sin(time*.45+phase+view*4.);
 }
 float colorShift=.5+.5*sin(p.x*3.+phase+time*.17+view*2.);
 vec3 tint=mix(primary,secondary,colorShift*.45);
 return (tint*mask*1.9+secondary*accent*1.35)*anatomy*pulse+primary*view*.035;
}`;
