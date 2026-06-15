import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

// data: [{segment, year, count}]
export function createStackedArea(data, containerId = "heatmap") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const W = rect.width || 900;
    const H = rect.height || 480;
    const m = { top: 20, right: 150, bottom: 42, left: 72 };
    const w = W - m.left - m.right;
    const h = H - m.top - m.bottom;

    const svg = d3.select(container)
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("preserveAspectRatio", "none");
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const segments = [...new Set(data.map(d => d.segment))].filter(Boolean).sort();
    const years    = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);

    const pivoted = years.map(year => {
        const row = { year };
        segments.forEach(seg => {
            const found = data.find(d => d.year === year && d.segment === seg);
            row[seg] = found ? found.count : 0;
        });
        return row;
    });

    
    const series = d3.stack().keys(segments)(pivoted);
    const COLORS = ["#22c55e", "#06b6d4", "#8b5cf6", "#f97316", "#ec4899", "#facc15"];
    const color  = d3.scaleOrdinal().domain(segments).range(COLORS);

    const x = d3.scaleLinear().domain(d3.extent(years)).range([0, w]);
    const y = d3.scaleLinear()
        .domain([0, d3.max(series, s => d3.max(s, d => d[1]))])
        .range([h, 0]).nice();

    const clipId = "area-clip-" + containerId;
    svg.append("defs").append("clipPath").attr("id", clipId)
        .append("rect").attr("x", 0).attr("y", 0).attr("width", 0).attr("height", h + m.top)
        .transition().duration(1200).ease(d3.easeCubicOut)
        .attr("width", w);

    g.append("g")
        .call(d3.axisLeft(y).tickSize(-w).tickFormat(""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#1e293b").attr("stroke-dasharray", "3,3"));


    const area = d3.area()
        .x(d => x(d.data.year))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveMonotoneX);

    g.selectAll(".area")
        .data(series).enter().append("path")
        .attr("class", "area")
        .attr("fill", d => color(d.key))
        .attr("fill-opacity", 0.7)
        .attr("stroke", d => color(d.key))
        .attr("stroke-width", 1.2)
        .attr("stroke-opacity", 0.6)
        .attr("clip-path", `url(#${clipId})`) 
        .attr("d", area)
        .on("mousemove", (event, d) => {
            const [mx] = d3.pointer(event, g.node());
            const year = Math.round(x.invert(mx));
            const row  = pivoted.find(p => p.year === year);
            if (row) showTooltip(event,
                `<strong>${d.key}</strong> · ${year}<br>${d3.format(",")(row[d.key])} registrations`);
        })
        .on("mouseout", hideTooltip);

    g.append("g").attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")).tickValues(years))
        .call(g => g.select(".domain").attr("stroke", "#334155"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13))
        .call(g => g.selectAll("line").attr("stroke", "#334155"));

    g.append("g")
        .call(d3.axisLeft(y).ticks(6)
            .tickFormat(d => d >= 1e6 ? d3.format(".1f")(d / 1e6) + "M"
                           : d >= 1e3 ? d3.format(".0f")(d / 1e3) + "k" : d))
        .call(g => g.select(".domain").attr("stroke", "#334155"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13))
        .call(g => g.selectAll("line").attr("stroke", "#334155"));

    g.append("text").attr("fill", "#64748b").attr("font-size", 13)
        .attr("text-anchor", "middle").attr("x", w / 2).attr("y", h + 36)
        .text("Year");
    g.append("text").attr("fill", "#64748b").attr("font-size", 13)
        .attr("text-anchor", "middle")
        .attr("transform", `translate(-54,${h / 2}) rotate(-90)`)
        .text("Registrations");

    const legend = g.append("g").attr("transform", `translate(${w + 18}, 10)`);
    segments.forEach((seg, i) => {
        const ly = i * 26;
        legend.append("rect")
            .attr("x", 0).attr("y", ly).attr("width", 12).attr("height", 12)
            .attr("rx", 2).attr("fill", color(seg)).attr("fill-opacity", 0.85);
        legend.append("text")
            .attr("x", 18).attr("y", ly + 10)
            .attr("fill", "#9ca3af").attr("font-size", 13)
            .text(seg);
    });
}
