(async function () {
  const container = document.getElementById("page-connections");
  if (!container) return;

  const stripQuotes = (val) =>
    String(val ?? "").replace(/^"+|"+$/g, "").trim();

  const normalizePath = (url) => {
    const clean = decodeURIComponent(stripQuotes(url))
      .split("#")[0]
      .split("?")[0]
      .toLowerCase();
    return clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
  };

  const currentPath = normalizePath(container.dataset.pageUrl);
  const backlinksEl = document.getElementById("backlinks-list");
  const localGraphEl = document.getElementById("local-graph-list");

  try {
    const res = await fetch("/graph.json", { cache: "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const nodeById = new Map();
    const nodeByFile = new Map();

    for (const raw of data.nodes || []) {
      const id = stripQuotes(raw.id);
      const file = normalizePath(raw.file);
      const title = stripQuotes(raw.title) || file || id;
      const node = { id, file, title };
      if (id) nodeById.set(id, node);
      if (file) nodeByFile.set(file, node);
    }

    const currentNode = nodeByFile.get(currentPath);
    if (!currentNode) {
      backlinksEl.innerHTML = "<li>No backlinks yet.</li>";
      localGraphEl.innerHTML = "<li>No connected pages yet.</li>";
      return;
    }

    const resolveRef = (ref) => {
      const cleaned = stripQuotes(ref);
      return nodeById.get(cleaned) || nodeByFile.get(normalizePath(cleaned));
    };

    const links = (data.links || [])
      .map((l) => ({
        source: resolveRef(l.source),
        target: resolveRef(l.target),
      }))
      .filter((l) => l.source && l.target);

    // Backlinks: other nodes linking into the current node
    const backlinks = [
      ...new Map(
        links
          .filter((l) => l.target.id === currentNode.id && l.source.id !== currentNode.id)
          .map((l) => [l.source.id, l.source])
      ).values(),
    ];

    // Local graph: 1-hop incoming + outgoing neighbors
    const outgoing = links
      .filter((l) => l.source.id === currentNode.id && l.target.id !== currentNode.id)
      .map((l) => l.target);

    const neighbors = [
      ...new Map(
        [...backlinks, ...outgoing].map((n) => [n.id, n])
      ).values(),
    ];

    const renderList = (el, items, emptyText) => {
      el.innerHTML = "";
      if (!items.length) {
        const li = document.createElement("li");
        li.textContent = emptyText;
        el.appendChild(li);
        return;
      }
      for (const item of items) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = item.file;
        a.textContent = item.title;
        li.appendChild(a);
        el.appendChild(li);
      }
    };

    renderList(backlinksEl, backlinks, "No backlinks yet.");
    renderList(localGraphEl, neighbors, "No connected pages yet.");
  } catch (err) {
    backlinksEl.innerHTML = "<li>Could not load backlinks.</li>";
    localGraphEl.innerHTML = "<li>Could not load connections.</li>";
    console.error("Graph load failed:", err);
  }
})();
