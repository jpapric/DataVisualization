import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

// data: [{make, count}]
export function createBarChart(data, containerId = "barChart") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const chartWrap = container.parentElement;
    if (!chartWrap.querySelector(".chart-controls")) {
        const ctrl = document.createElement("div");
        ctrl.className = "chart-controls";
        ctrl.innerHTML = `
            <span class="ctrl-label">Sort</span>
            <button class="ctrl-btn active" data-sort="count">By Registrations</button>
            <button class="ctrl-btn"        data-sort="alpha">A – Z</button>
        `;
        chartWrap.insertBefore(ctrl, container);
    }
    const controls = chartWrap.querySelector(".chart-controls");
    let sortKey = "count"; 

    const rect = container.getBoundingClientRect();
    const W = rect.width  || 900;
    const H = rect.height || 520;
    const m = { top: 10, right: 80, bottom: 30, left: 110 };
    const w = W - m.left - m.right;
    const h = H - m.top - m.bottom;

    const svg = d3.select(container)
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("preserveAspectRatio", "none");
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const COLORS = ["#22c55e","#06b6d4","#8b5cf6","#f97316","#ec4899",
                    "#facc15","#38bdf8","#a3e635","#fb923c","#c084fc",
                    "#67e8f9","#86efac","#fde68a","#fca5a5","#d8b4fe"];

    const ranked = [...data].sort((a, b) => b.count - a.count);
    const colorMap = new Map(ranked.map((d, i) => [d.make, COLORS[i % COLORS.length]]));

    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.count) * 1.12]).range([0, w]);
    const y = d3.scaleBand().range([0, h]).padding(0.22);

    g.append("g").attr("class", "grid")
        .call(d3.axisBottom(x).tickSize(h).tickFormat(""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#1a2235").attr("stroke-dasharray", "3,3"));

    const yAxisG = g.append("g").attr("class", "y-axis");

    g.append("g").attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).tickFormat(d => d >= 1e3 ? d3.format(".0f")(d / 1e3) + "k" : d).ticks(6))
        .call(g => g.select(".domain").attr("stroke", "#263044"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13))
        .call(g => g.selectAll("line").attr("stroke", "#263044"));

    function update(animate = true) {
        const dur = animate ? 600 : 0;
        const sorted = sortKey === "count"
            ? [...data].sort((a, b) => b.count - a.count)
            : [...data].sort((a, b) => a.make.localeCompare(b.make));

        y.domain(sorted.map(d => d.make));

        yAxisG.transition().duration(dur)
            .call(d3.axisLeft(y).tickSize(0)) 
            .call(g => g.select(".domain").remove()) 
            .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13).attr("dx", -6)); 

        const bars = g.selectAll(".bar").data(sorted, d => d.make);

        bars.enter().append("rect").attr("class", "bar")
            .attr("y", d => y(d.make)).attr("height", y.bandwidth())
            .attr("x", 0).attr("width", 0).attr("rx", 4)
            .attr("fill", d => colorMap.get(d.make))
            .on("mouseover", (event, d) => showTooltip(event,
                `<strong>${d.make}</strong><br>${d3.format(",")(d.count)} registrations`))
            .on("mousemove", moveTooltip).on("mouseout", hideTooltip)
          .merge(bars)
            .transition().duration(dur).ease(d3.easeCubicOut)
            .attr("y", d => y(d.make)).attr("height", y.bandwidth())
            .attr("width", d => x(d.count))
            .attr("fill", d => colorMap.get(d.make));

        bars.exit().transition().duration(dur / 2).attr("width", 0).remove();

        const labels = g.selectAll(".bar-label").data(sorted, d => d.make);

        labels.enter().append("text").attr("class", "bar-label")
            .attr("y", d => y(d.make) + y.bandwidth() / 2 + 4)
            .attr("x", d => x(d.count) + 7)
            .attr("fill", "#9ca3af").attr("font-size", 13).attr("opacity", 0)
            .text(d => d3.format(",")(d.count))
          .merge(labels)
            .transition().duration(dur).ease(d3.easeCubicOut)
            .attr("y", d => y(d.make) + y.bandwidth() / 2 + 4)
            .attr("x", d => x(d.count) + 7)
            .attr("opacity", 1)
            .text(d => d3.format(",")(d.count));

        labels.exit().transition().duration(dur / 2).attr("opacity", 0).remove();
    }

    update(true);

    controls.querySelectorAll(".ctrl-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            controls.querySelectorAll(".ctrl-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            sortKey = btn.dataset.sort;
            update(true);
        });
    });
}
