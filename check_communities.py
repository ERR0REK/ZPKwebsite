import json
from pathlib import Path

with open('graphify-out/graph.json', 'r', encoding='utf-8') as f:
    graph = json.load(f)

# Check for community field
communities = set()
for n in graph['nodes']:
    if 'community' in n:
        communities.add(n['community'])
    if 'cluster' in n:
        communities.add(n['cluster'])
    if 'community_id' in n:
        communities.add(n['community_id'])

print('Communities found:', communities)

# Show sample nodes
for n in graph['nodes'][:5]:
    print(f"Node: {n.get('label', n.get('id'))} - keys: {list(n.keys())}")