"""Fetch CC0 PBR maps and HDR illumination from Poly Haven's public asset API."""
import json,pathlib,subprocess
def fetch(url): return subprocess.check_output(['curl','--fail','-L','-s','--retry','2',url])
base=pathlib.Path(__file__).resolve().parents[1]
root=base/'assets/textures';root.mkdir(parents=True,exist_ok=True)
credits=[]
for asset in ['coral_ground_02','coral_gravel','rock_face_03','coast_land_rocks_01']:
 data=json.loads(fetch('https://api.polyhaven.com/files/'+asset))
 for dest,keys in [('color',['Diffuse','diff']),('normal',['nor_gl']),('roughness',['Rough','rough']),('ao',['AO'])]:
  if dest=='ao' and asset!='coast_land_rocks_01':continue
  key=next((k for k in keys if k in data),None)
  if not key:continue
  res='2k' if asset=='coast_land_rocks_01' else '1k'
  url=data[key][res]['jpg']['url'];path=root/f'{asset}_{dest}.jpg'
  if not path.exists():path.write_bytes(fetch(url))
  credits.append({'file':str(path.relative_to(base)),'source':url,'license':'CC0-1.0','asset':'https://polyhaven.com/a/'+asset})
asset='studio_small_08';data=json.loads(fetch('https://api.polyhaven.com/files/'+asset));url=data['hdri']['1k']['hdr']['url'];path=base/'assets/lighting/studio_small_08_1k.hdr';path.parent.mkdir(exist_ok=True)
if not path.exists():path.write_bytes(fetch(url))
credits.append({'file':str(path.relative_to(base)),'source':url,'license':'CC0-1.0','asset':'https://polyhaven.com/a/'+asset})
(root/'credits.json').write_text(json.dumps(credits,indent=2))
