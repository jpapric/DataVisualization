import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

// historical: [{year, sales}]  projections: [{scenario, year, sales}]
export function createFutureChart(historical, projections, containerId = "futureChart") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const W = rect.width  || 900;
    const H = rect.height || 500;
    const m = { top: 30, right: 30, bottom: 48, left: 80 };
    const w = W - m.left - m.right;
    const h = H - m.top - m.bottom;

    const svg = d3.select(container)
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("preserveAspectRatio", "none");
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const steps = projections.filter(d => d.scenario === "STEPS").sort((a, b) => a.year - b.year);
    const aps   = projections.filter(d => d.scenario === "APS").sort((a, b) => a.year - b.year);
    const hist  = [...historical].sort((a, b) => a.year - b.year);
    const lastHist = hist[hist.length - 1];

    const stepsLine = [lastHist, ...steps];
    const apsLine   = [lastHist, ...aps];

    const allYears = [
        ...hist.map(d => d.year),
        ...steps.map(d => d.year),
        ...aps.map(d => d.year)
    ];
    const allSales = [
        ...hist.map(d => d.sales),
        ...steps.map(d => d.sales),
        ...aps.map(d => d.sales)
    ];

    const x = d3.scaleLinear()
        .domain([d3.min(allYears), d3.max(allYears)])
        .range([0, w]);
    const y = d3.scaleLinear()
        .domain([0, d3.max(allSales) * 1.1])
        .range([h, 0]);

    g.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(6).tickSize(-w).tickFormat(""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#1a2235").attr("stroke-dasharray", "3,3"));

    const todayX = x(lastHist.year);
    g.append("rect")
        .attr("x", todayX).attr("y", 0)
        .attr("width", w - todayX).attr("height", h)
        .attr("fill", "#0f1e30").attr("opacity", 0.6);

    const bandArea = d3.area()
        .x(d => x(d.year))
        .y0((_, i) => y(stepsLine[i].sales))
        .y1(d => y(d.sales))
        .curve(d3.curveMonotoneX);
    g.append("path").datum(apsLine)
        .attr("fill", "#22c55e").attr("fill-opacity", 0.08)
        .attr("d", bandArea);

    const tickYears = [...new Set([...hist.map(d => d.year), ...steps.map(d => d.year)])];
    g.append("g").attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d")))
        .call(g => g.select(".domain").attr("stroke", "#263044"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 12))
        .call(g => g.selectAll("line").attr("stroke", "#263044"));

    g.append("g")
        .call(d3.axisLeft(y).ticks(6).tickFormat(d =>
            d >= 1e6 ? d3.format(".0f")(d / 1e6) + "M" :
            d >= 1e3 ? d3.format(".0f")(d / 1e3) + "k" : d))
        .call(g => g.select(".domain").attr("stroke", "#263044"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13))
        .call(g => g.selectAll("line").attr("stroke", "#263044"));

    g.append("text").attr("fill", "#4b5563").attr("font-size", 13)
        .attr("text-anchor", "middle").attr("x", w / 2).attr("y", h + 40)
        .text("Year");
    g.append("text").attr("fill", "#4b5563").attr("font-size", 13)
        .attr("text-anchor", "middle")
        .attr("transform", `translate(-66,${h / 2}) rotate(-90)`)
        .text("EV Sales (vehicles)");

    const defs = svg.append("defs");

    const grad = defs.append("linearGradient")
        .attr("id", "futureHistGrad").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#22c55e").attr("stop-opacity", 0.25);
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#22c55e").attr("stop-opacity", 0.02);

    const histArea = d3.area().x(d => x(d.year)).y0(h).y1(d => y(d.sales)).curve(d3.curveMonotoneX);
    const histLine = d3.line().x(d => x(d.year)).y(d => y(d.sales)).curve(d3.curveMonotoneX);

    g.append("path").datum(hist).attr("fill", "url(#futureHistGrad)").attr("d", histArea);

    const hPath = g.append("path").datum(hist)
        .attr("fill", "none").attr("stroke", "#22c55e").attr("stroke-width", 2.5)
        .attr("d", histLine);
    const hLen = hPath.node().getTotalLength();
    hPath.attr("stroke-dasharray", hLen).attr("stroke-dashoffset", hLen)
        .transition().duration(1200).ease(d3.easeCubicInOut).attr("stroke-dashoffset", 0);

    const stepsPath = g.append("path").datum(stepsLine)
        .attr("fill", "none").attr("stroke", "#22c55e").attr("stroke-width", 2)
        .attr("stroke-dasharray", "8,5").attr("stroke-opacity", 0.6)
        .attr("d", d3.line().x(d => x(d.year)).y(d => y(d.sales)).curve(d3.curveMonotoneX));
    const sLen = stepsPath.node().getTotalLength();
    stepsPath.attr("stroke-dasharray", sLen).attr("stroke-dashoffset", sLen)
        .transition().duration(1000).delay(1200).ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0)
        .on("end", () => stepsPath.attr("stroke-dasharray", "8,5"));

    const apsPath = g.append("path").datum(apsLine)
        .attr("fill", "none").attr("stroke", "#22c55e").attr("stroke-width", 2)
        .attr("stroke-dasharray", "8,5")
        .attr("d", d3.line().x(d => x(d.year)).y(d => y(d.sales)).curve(d3.curveMonotoneX));
    const aLen = apsPath.node().getTotalLength();
    apsPath.attr("stroke-dasharray", aLen).attr("stroke-dashoffset", aLen)
        .transition().duration(1000).delay(1200).ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0)
        .on("end", () => apsPath.attr("stroke-dasharray", "8,5"));

    [[stepsLine, 0.6], [apsLine, 1]].forEach(([line, opacity]) => {
        g.selectAll(null).data(line.slice(1)).enter().append("circle")
            .attr("cx", d => x(d.year)).attr("cy", d => y(d.sales))
            .attr("r", 4).attr("fill", "#22c55e").attr("fill-opacity", opacity)
            .attr("stroke", "#0a0f1a").attr("stroke-width", 1.5)
            .on("mouseover", (event, d) => showTooltip(event,
                `<strong>${d.year}</strong> · ${d.scenario || "Historical"}<br>${d3.format(",")(d.sales)} vehicles`))
            .on("mousemove", moveTooltip).on("mouseout", hideTooltip);
    });

    g.append("line")
        .attr("x1", todayX).attr("x2", todayX)
        .attr("y1", 0).attr("y2", h)
        .attr("stroke", "#374151").attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
    g.append("text")
        .attr("x", todayX + 6).attr("y", 14)
        .attr("fill", "#6b7280").attr("font-size", 11)
        .text(`${lastHist.year} · last data`);

    const lastSteps = stepsLine[stepsLine.length - 1];
    const lastAps   = apsLine[apsLine.length - 1];
    g.append("text").attr("x", x(lastSteps.year) + 6).attr("y", y(lastSteps.sales) + 4)
        .attr("fill", "#22c55e").attr("fill-opacity", 0.6).attr("font-size", 11).text("STEPS");
    g.append("text").attr("x", x(lastAps.year) + 6).attr("y", y(lastAps.sales) + 4)
        .attr("fill", "#22c55e").attr("font-size", 11).text("APS");

    const leg = svg.append("g").attr("transform", `translate(${m.left + 10}, ${m.top - 18})`);
    [
        { label: "Historical", color: "#22c55e", dash: null,  opacity: 1 },
        { label: "STEPS scenario", color: "#22c55e", dash: "8,5", opacity: 0.6 },
        { label: "APS scenario",   color: "#22c55e", dash: "8,5", opacity: 1 },
    ].forEach((item, i) => {
        const lg = leg.append("g").attr("transform", `translate(${i * 140}, 0)`);
        lg.append("line").attr("x1", 0).attr("y1", 5).attr("x2", 22).attr("y2", 5)
            .attr("stroke", item.color).attr("stroke-opacity", item.opacity)
            .attr("stroke-width", 2).attr("stroke-dasharray", item.dash);
        lg.append("text").attr("x", 28).attr("y", 9)
            .attr("fill", "#9ca3af").attr("font-size", 12).text(item.label);
    });
}
