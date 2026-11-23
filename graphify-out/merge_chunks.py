import json
from pathlib import Path

graphify_out = Path('.')
all_nodes = []
all_edges = []
all_hyperedges = []

for i in range(19):
    chunk_file = graphify_out / f'.graphify_chunk_{i:02d}.json'
    if chunk_file.exists() and chunk_file.is_file():
        data = json.loads(chunk_file.read_text(encoding='utf-8'))
        all_nodes.extend(data.get('nodes', []))
        all_edges.extend(data.get('edges', []))
        all_hyperedges.extend(data.get('hyperedges', []))
        print(f'Chunk {i:02d}: {len(data.get("nodes", []))} nodes, {len(data.get("edges", []))} edges, {len(data.get("hyperedges", []))} hyperedges')
    else:
        print(f'Chunk {i:02d}: NOT FOUND or is directory')

print(f'\nTOTAL: {len(all_nodes)} nodes, {len(all_edges)} edges, {len(all_hyperedges)} hyperedges')

merged = {
    'nodes': all_nodes,
    'edges': all_edges,
    'hyperedges': all_hyperedges
}
(graphify_out / 'graph.json').write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding='utf-8')
print('Merged graph written to graph.json')