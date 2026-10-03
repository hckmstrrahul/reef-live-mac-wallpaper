// Shared artistic pigments for the fictional Martian sea. All values are
// linear radiance; light lives in narrow tissue markings, not whole silhouettes.
export const planetPigmentGLSL = `
vec3 alienPalette(float seed){
 float family=mod(seed,3.);
 return family<1. ? mix(vec3(1.7,.24,.045),vec3(1.5,.72,.11),family)
      : family<2. ? mix(vec3(.12,1.3,.62),vec3(.4,1.5,1.05),family-1.)
      : mix(vec3(1.35,.055,.31),vec3(1.6,.25,.64),family-2.);
}
// Distorted contour lines resemble living channels. Anti-alias thin luminous
// edges so distant colonies don't crawl or turn into harsh white noise.
float alienChannels(vec3 p){
 float field=p.y*2.7+sin(p.x*3.1+sin(p.z*2.3))*1.25+sin(p.z*4.3+p.x)*.65;
 float line=abs(sin(field*3.14159));
 float aa=max(.025,fwidth(line)*.65);
 return 1.-smoothstep(.055,.11+aa,line);
}`;
