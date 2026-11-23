import json
from pathlib import Path

with open('graphify-out/graph.json', 'r', encoding='utf-8') as f:
    graph = json.load(f)

# Fix nodes - add missing source_file and confidence
for node in graph['nodes']:
    if 'source_file' not in node:
        if 'properties' in node and 'source_file' in node['properties']:
            node['source_file'] = node['properties']['source_file']
        elif node['type'] == 'IMAGE':
            node['source_file'] = f"src/Assets/{node.get('label', 'unknown')}"
        else:
            node['source_file'] = "unknown"

    if 'confidence' not in node:
        node['confidence'] = 1.0

# Fix edges - add missing confidence
for edge in graph['edges']:
    if 'confidence' not in edge:
        edge['confidence'] = 1.0

# Write fixed graph
with open('graphify-out/graph.json', 'w', encoding='utf-8') as f:
    json.dump(graph, f, indent=2, ensure_ascii=False)

print(f"Fixed graph: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")
print("Done!")