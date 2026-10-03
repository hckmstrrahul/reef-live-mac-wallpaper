"""Restore original Smithsonian Open Access specimen assets from recorded URLs."""
import json, pathlib, subprocess
root=pathlib.Path(__file__).resolve().parents[1]/'assets/models/corals'
(root/'source').mkdir(parents=True,exist_ok=True)
for item in json.loads((root/'credits.json').read_text()):
 target=root/'source'/(item['name']+'.glb')
 if not target.exists():subprocess.run(['curl','--fail','-L','--retry','2',item['source'],'-o',str(target)],check=True)
 print(item['species'], target)
