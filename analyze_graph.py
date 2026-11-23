import json
from pathlib import Path
from collections import Counter

with open('graphify-out/graph.json', 'r', encoding='utf-8') as f:
    graph = json.load(f)

print(f'Nodes: {len(graph["nodes"])}')
print(f'Edges: {len(graph["edges"])}')
print(f'Hyperedges: {len(graph["hyperedges"])}')

node_types = Counter(n.get('type', 'UNKNOWN') for n in graph['nodes'])
print('Node types:', dict(node_types))

edge_types = Counter(e.get('type', 'UNKNOWN') for e in graph['edges'])
print('Edge types:', dict(edge_types))