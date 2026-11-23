import json
with open('graphify-out/graph.json', 'r', encoding='utf-8') as f:
    graph = json.load(f)

from collections import Counter
node_types = Counter(n.get('type', 'UNKNOWN') for n in graph['nodes'])
print('Node types:', dict(node_types))

images = [n for n in graph['nodes'] if n.get('type') == 'IMAGE']
print(f'IMAGE nodes: {len(images)}')
for img in images:
    print(f'  - {img.get("label", img.get("id"))} [{img.get("source_file", "no source")}]')

docs = [n for n in graph['nodes'] if n.get('type') == 'DOC_SECTION']
print(f'DOC_SECTION nodes: {len(docs)}')