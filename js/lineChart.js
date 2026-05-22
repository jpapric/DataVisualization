import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

// data: [{year, powertrain, sales}]  (powertrain_by_year format)
export function createLineChart(data, containerId = "lineChart") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const W = rect.width  || 900;
    const H = rect.height || 500;
    const m = { top: 20, right: 30, bottom: 48, left: 80 };
    const w = W - m.left - m.right;
    const h = H - m.top - m.bottom;

    const svg = d3.select(container)
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("preserveAspectRatio", "none");
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const byPT   = d3.group(data, d => d.powertrain);
    const COLORS = { BEV: "#22c55e", PHEV: "#06b6d4", FCEV: "#8b5cf6" };
    const keys   = ["BEV", "PHEV", "FCEV"].filter(k => byPT.has(k));

    const series = keys.map(k => ({
        key: k,
        values: [...byPT.get(k)].sort((a, b) => a.year - b.year)
    }));

    const allYears = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);
    const x = d3.scaleLinear().domain(d3.extent(allYears)).range([0, w]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(series, s => d3.max(s.values, d => d.sales)) * 1.08])
        .range([h, 0]);

    // Grid
    g.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(6).tickSize(-w).tickFormat(""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#1a2235").attr("stroke-dasharray", "3,3"));

    // Bottom axis
    g.append("g").attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")).tickValues(allYears))
        .call(g => g.select(".domain").attr("stroke", "#263044"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13))
        .call(g => g.selectAll("line").attr("stroke", "#263044"));

    // Left axis — BEV / PHEV
    g.append("g")
        .call(d3.axisLeft(y).ticks(6).tickFormat(d =>
            d >= 1e6 ? d3.format(".0f")(d / 1e6) + "M" :
            d >= 1e3 ? d3.format(".0f")(d / 1e3) + "k" : d))
        .call(g => g.select(".domain").attr("stroke", "#263044"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13))
        .call(g => g.selectAll("line").attr("stroke", "#263044"));

    // Axis labels
    g.append("text").attr("fill", "#4b5563").attr("font-size", 13)
        .attr("text-anchor", "middle").attr("x", w / 2).attr("y", h + 40)
        .text("Year");
    g.append("text").attr("fill", "#4b5563").attr("font-size", 13)
        .attr("text-anchor", "middle")
        .attr("transform", `translate(-66,${h / 2}) rotate(-90)`)
        .text("EV Sales (vehicles)");

    const defs = svg.append("defs");

    // Draw all series
    series.forEach((s, i) => {
        const col     = COLORS[s.key];
        const lineGen = d3.line().x(d => x(d.year)).y(d => y(d.sales)).curve(d3.curveMonotoneX);

        if (s.key === "BEV") {
            const grad = defs.append("linearGradient")
                .attr("id", "areaGrad-BEV").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
            grad.append("stop").attr("offset", "0%").attr("stop-color", col).attr("stop-opacity", 0.28);
            grad.append("stop").attr("offset", "100%").attr("stop-color", col).attr("stop-opacity", 0.02);
            const areaGen = d3.area().x(d => x(d.year)).y0(h).y1(d => y(d.sales)).curve(d3.curveMonotoneX);
            g.append("path").datum(s.values).attr("fill", "url(#areaGrad-BEV)").attr("d", areaGen);
        }

        const path = g.append("path").datum(s.values)
            .attr("fill", "none").attr("stroke", col)
            .attr("stroke-width", s.key === "BEV" ? 2.5 : 2)
            .attr("d", lineGen);

        const len = path.node().getTotalLength();
        path.attr("stroke-dasharray", len).attr("stroke-dashoffset", len)
            .transition().duration(1400).delay(i * 200).ease(d3.easeCubicInOut)
            .attr("stroke-dashoffset", 0);

        g.selectAll(`.dot-${s.key}`)
            .data(s.values).enter().append("circle")
            .attr("class", `dot-${s.key}`)
            .attr("cx", d => x(d.year)).attr("cy", d => y(d.sales))
            .attr("r", 3.5).attr("fill", col).attr("stroke", "#0a0f1a").attr("stroke-width", 1.5)
            .on("mouseover", (event, d) => showTooltip(event,
                `<strong>${d.year}</strong> · ${s.key}<br>${d3.format(",")(d.sales)} vehicles`))
            .on("mousemove", moveTooltip).on("mouseout", hideTooltip);
    });

    // Legend
    const legendG = svg.append("g")
        .attr("transform", `translate(${m.left + 10}, ${m.top - 10})`);
    keys.forEach((k, i) => {
        const col = COLORS[k];
        const lg  = legendG.append("g").attr("transform", `translate(${i * 100}, 0)`);
        lg.append("line").attr("x1", 0).attr("y1", 5).attr("x2", 20).attr("y2", 5)
            .attr("stroke", col).attr("stroke-width", k === "BEV" ? 2.5 : 2);
        lg.append("text").attr("x", 25).attr("y", 9)
            .attr("fill", "#9ca3af").attr("font-size", 13).text(k);
    });
}
