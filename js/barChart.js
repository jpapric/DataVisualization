import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

// Horizontal bar chart  data: [{make, count}]
export function createBarChart(data, containerId = "barChart") {
    const container = document.getElementById(containerId);
    if (!container) return;

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

    const sorted = [...data].sort((a, b) => b.count - a.count);
    const maxVal = d3.max(sorted, d => d.count);

    const COLORS = ["#22c55e","#06b6d4","#8b5cf6","#f97316","#ec4899",
                    "#facc15","#38bdf8","#a3e635","#fb923c","#c084fc",
                    "#67e8f9","#86efac","#fde68a","#fca5a5","#d8b4fe"];

    const y = d3.scaleBand()
        .domain(sorted.map(d => d.make))
        .range([0, h]).padding(0.22);

    const x = d3.scaleLinear()
        .domain([0, maxVal * 1.12])
        .range([0, w]);

    // vertical grid
    g.append("g").attr("class", "grid")
        .call(d3.axisBottom(x).tickSize(h).tickFormat(""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#1a2235").attr("stroke-dasharray", "3,3"));

    // y axis (make names)
    g.append("g")
        .call(d3.axisLeft(y).tickSize(0))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("text")
            .attr("fill", "#9ca3af").attr("font-size", 13)
            .attr("dx", -6));

    // x axis bottom
    g.append("g").attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).tickFormat(d => d >= 1e3 ? d3.format(".0f")(d / 1e3) + "k" : d).ticks(6))
        .call(g => g.select(".domain").attr("stroke", "#263044"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13))
        .call(g => g.selectAll("line").attr("stroke", "#263044"));

    // bars
    g.selectAll(".bar")
        .data(sorted).enter().append("rect")
        .attr("class", "bar")
        .attr("y", d => y(d.make))
        .attr("height", y.bandwidth())
        .attr("x", 0).attr("width", 0)
        .attr("rx", 4)
        .attr("fill", (_, i) => COLORS[i % COLORS.length])
        .on("mouseover", (event, d) => showTooltip(event,
            `<strong>${d.make}</strong><br>${d3.format(",")(d.count)} registrations`))
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)
        .transition().duration(800).delay((_, i) => i * 40).ease(d3.easeCubicOut)
        .attr("width", d => x(d.count));

    // value labels
    g.selectAll(".bar-label")
        .data(sorted).enter().append("text")
        .attr("class", "bar-label")
        .attr("y", d => y(d.make) + y.bandwidth() / 2 + 4)
        .attr("x", d => x(d.count) + 7)
        .attr("fill", "#9ca3af").attr("font-size", 13)
        .attr("opacity", 0)
        .text(d => d3.format(",")(d.count))
        .transition().duration(800).delay((_, i) => i * 40 + 200)
        .attr("opacity", 1);
}
