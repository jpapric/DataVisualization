import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

// data: ev_specs [{brand, model, battery_kWh, range_km, efficiency_wh_km, accel_s, segment}]
export function createScatterPlot(data, containerId = "scatterPlot") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const W = rect.width || 700;
    const H = rect.height || 420;
    const m = { top: 24, right: 150, bottom: 52, left: 72 };
    const w = W - m.left - m.right;
    const h = H - m.top - m.bottom;

    const valid = data.filter(d => d.battery_kWh && d.range_km);

    const svg = d3.select(container)
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("preserveAspectRatio", "none");
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const segments = [...new Set(valid.map(d => d.segment || "Other"))].filter(Boolean).sort();
    const COLORS   = ["#22c55e","#06b6d4","#8b5cf6","#f97316","#ec4899","#facc15","#38bdf8"];
    const color    = d3.scaleOrdinal().domain(segments).range(COLORS);

    const xMax = d3.max(valid, d => d.battery_kWh);
    const yMax = d3.max(valid, d => d.range_km);
    const x = d3.scaleLinear().domain([0, xMax * 1.05]).range([0, w]);
    const y = d3.scaleLinear().domain([0, yMax * 1.05]).range([h, 0]);

    // Grid
    g.append("g")
        .call(d3.axisLeft(y).tickSize(-w).tickFormat(""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#1e293b").attr("stroke-dasharray", "3,3"));
    g.append("g").attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).tickSize(-h).tickFormat(""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#1e293b").attr("stroke-dasharray", "3,3"));

    // Linear regression trend line
    const n      = valid.length;
    const sumX   = d3.sum(valid, d => d.battery_kWh);
    const sumY   = d3.sum(valid, d => d.range_km);
    const sumXY  = d3.sum(valid, d => d.battery_kWh * d.range_km);
    const sumX2  = d3.sum(valid, d => d.battery_kWh ** 2);
    const slope  = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
    const interc = (sumY - slope * sumX) / n;

    g.append("line")
        .attr("x1", x(0)).attr("y1", y(interc))
        .attr("x2", x(xMax)).attr("y2", y(slope * xMax + interc))
        .attr("stroke", "#374151").attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "6,4");
    g.append("text")
        .attr("x", x(xMax * 0.55)).attr("y", y(slope * xMax * 0.55 + interc) - 8)
        .attr("fill", "#4b5563").attr("font-size", 11).attr("text-anchor", "middle")
        .text("trend");

    // Axes
    g.append("g").attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).ticks(6))
        .call(g => g.select(".domain").attr("stroke", "#334155"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13))
        .call(g => g.selectAll("line").attr("stroke", "#334155"));
    g.append("g")
        .call(d3.axisLeft(y).ticks(6))
        .call(g => g.select(".domain").attr("stroke", "#334155"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13))
        .call(g => g.selectAll("line").attr("stroke", "#334155"));

    // Axis labels
    g.append("text").attr("fill", "#64748b").attr("font-size", 13)
        .attr("text-anchor", "middle").attr("x", w / 2).attr("y", h + 42)
        .text("Battery Capacity (kWh)");
    g.append("text").attr("fill", "#64748b").attr("font-size", 13)
        .attr("text-anchor", "middle")
        .attr("transform", `translate(-54,${h / 2}) rotate(-90)`)
        .text("Range (km)");

    // Dots
    g.selectAll(".dot")
        .data(valid).enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d.battery_kWh))
        .attr("cy", d => y(d.range_km))
        .attr("r", 0)
        .attr("fill", d => color(d.segment || "Other"))
        .attr("fill-opacity", 0.72)
        .attr("stroke", "#0f172a").attr("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            const lines = [
                `<strong>${d.brand} ${d.model}</strong>`,
                `Battery: ${d.battery_kWh} kWh · Range: ${d.range_km} km`,
                d.efficiency_wh_km ? `Efficiency: ${d.efficiency_wh_km} Wh/km` : null,
                d.accel_s          ? `0–100 km/h: ${d.accel_s}s`               : null,
            ].filter(Boolean).join("<br>");
            showTooltip(event, lines);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout",  hideTooltip)
        .transition().duration(600).delay((_, i) => i * 1.5).ease(d3.easeCubicOut)
        .attr("r", 5);

    // Legend
    const legend = g.append("g").attr("transform", `translate(${w + 18}, 10)`);
    segments.forEach((seg, i) => {
        const ly = i * 24;
        legend.append("circle")
            .attr("cx", 5).attr("cy", ly + 5).attr("r", 5)
            .attr("fill", color(seg)).attr("fill-opacity", 0.85);
        legend.append("text")
            .attr("x", 16).attr("y", ly + 9)
            .attr("fill", "#9ca3af").attr("font-size", 12).text(seg);
    });
}
