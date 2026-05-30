import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

// data: [{year, powertrain, sales}]
export function createLineChart(data, containerId = "lineChart") {
    const container = document.getElementById(containerId);
    if (!container) return;

    // ── Toggle controls ───────────────────────────────────────────────────────
    const chartWrap = container.parentElement;
    if (!chartWrap.querySelector(".chart-controls")) {
        const ctrl = document.createElement("div");
        ctrl.className = "chart-controls";
        ctrl.innerHTML = `
            <span class="ctrl-label">Show</span>
            <button class="ctrl-btn active" data-pt="BEV">BEV</button>
            <button class="ctrl-btn active" data-pt="PHEV">PHEV</button>
            <button class="ctrl-btn active" data-pt="FCEV">FCEV</button>
        `;
        chartWrap.insertBefore(ctrl, container);
    }
    const controls = chartWrap.querySelector(".chart-controls");

    // ── SVG setup ─────────────────────────────────────────────────────────────
    const rect = container.getBoundingClientRect();
    const W = rect.width  || 900;
    const H = rect.height || 500;
    const m = { top: 24, right: 90, bottom: 48, left: 80 };
    const w = W - m.left - m.right;
    const h = H - m.top - m.bottom;

    const svg = d3.select(container)
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("preserveAspectRatio", "none");
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const COLORS = { BEV: "#22c55e", PHEV: "#06b6d4", FCEV: "#8b5cf6" };
    const byPT   = d3.group(data, d => d.powertrain);
    const allKeys = ["BEV", "PHEV", "FCEV"].filter(k => byPT.has(k));

    const series = allKeys.map(k => ({
        key: k,
        values: [...byPT.get(k)].sort((a, b) => a.year - b.year)
    }));

    const allYears = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);
    const x = d3.scaleLinear().domain(d3.extent(allYears)).range([0, w]);

    // ── Left scale: BEV + PHEV ────────────────────────────────────────────────
    const yLeft = d3.scaleLinear()
        .domain([0, d3.max(
            series.filter(s => s.key !== "FCEV"),
            s => d3.max(s.values, d => d.sales)
        )]).nice()
        .range([h, 0]);

    // ── Right scale: FCEV only ────────────────────────────────────────────────
    const fcevVals = series.find(s => s.key === "FCEV")?.values ?? [];
    const yRight = d3.scaleLinear()
        .domain([0, d3.max(fcevVals, d => d.sales)]).nice()
        .range([h, 0]);

    // ── Grid lines (left scale) ───────────────────────────────────────────────
    g.append("g").attr("class", "grid")
        .call(d3.axisLeft(yLeft).ticks(6).tickSize(-w).tickFormat(""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#1a2235").attr("stroke-dasharray", "3,3"));

    // ── X axis — every 2 years ────────────────────────────────────────────────
    g.append("g").attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x)
            .tickFormat(d3.format("d"))
            .tickValues(allYears.filter((_, i) => i % 2 === 0)))
        .call(g => g.select(".domain").attr("stroke", "#263044"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13))
        .call(g => g.selectAll("line").attr("stroke", "#263044"));

    // ── Left Y axis ───────────────────────────────────────────────────────────
    g.append("g")
        .call(d3.axisLeft(yLeft).ticks(6).tickFormat(d =>
            d >= 1e6 ? d3.format(".0f")(d / 1e6) + "M" :
            d >= 1e3 ? d3.format(".0f")(d / 1e3) + "k" : "0"))
        .call(g => g.select(".domain").attr("stroke", "#263044"))
        .call(g => g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 13))
        .call(g => g.selectAll("line").attr("stroke", "#263044"));

    g.append("text").attr("fill", "#4b5563").attr("font-size", 12)
        .attr("text-anchor", "middle")
        .attr("transform", `translate(-62,${h / 2}) rotate(-90)`)
        .text("BEV / PHEV Sales");

    // ── Right Y axis (FCEV) ───────────────────────────────────────────────────
    const rightAxisG = g.append("g")
        .attr("transform", `translate(${w}, 0)`);

    rightAxisG
        .call(d3.axisRight(yRight).ticks(5).tickFormat(d =>
            d >= 1e3 ? d3.format(".0f")(d / 1e3) + "k" : "0"))
        .call(g => g.select(".domain").attr("stroke", "#263044"))
        .call(g => g.selectAll("text").attr("fill", "#8b5cf6").attr("font-size", 12))
        .call(g => g.selectAll("line").attr("stroke", "#263044"));

    const rightLabel = g.append("text")
        .attr("fill", "#8b5cf6").attr("font-size", 12)
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${w + 72},${h / 2}) rotate(90)`)
        .text("FCEV Sales");

    // ── X axis label ──────────────────────────────────────────────────────────
    g.append("text").attr("fill", "#4b5563").attr("font-size", 13)
        .attr("text-anchor", "middle").attr("x", w / 2).attr("y", h + 40)
        .text("Year");

    // ── BEV area gradient ─────────────────────────────────────────────────────
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient")
        .attr("id", "lcBevGrad").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#22c55e").attr("stop-opacity", 0.28);
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#22c55e").attr("stop-opacity", 0.02);

    const active = new Set(allKeys);
    const seriesLayer = g.append("g").attr("class", "series-layer");

    function renderSeries() {
        const fcevOn = active.has("FCEV");
        rightAxisG.transition().duration(300).attr("opacity", fcevOn ? 1 : 0);
        rightLabel.transition().duration(300).attr("opacity", fcevOn ? 1 : 0);

        const activeSeries = series.filter(s => active.has(s.key));
        const groups = seriesLayer.selectAll(".series-g")
            .data(activeSeries, d => d.key);

        groups.exit().transition().duration(350).attr("opacity", 0).remove();

        const entering = groups.enter().append("g")
            .attr("class", "series-g")
            .attr("opacity", 0);
        entering.transition().duration(350).attr("opacity", 1);

        entering.each(function(s) {
            const grp = d3.select(this);
            const col  = COLORS[s.key];
            // Each series gets its own scale — explicit, no abstraction
            const yScale = s.key === "FCEV" ? yRight : yLeft;

            const lineGen = d3.line()
                .x(d => x(d.year))
                .y(d => yScale(d.sales))
                .curve(d3.curveMonotoneX);

            if (s.key === "BEV") {
                const areaGen = d3.area()
                    .x(d => x(d.year)).y0(h).y1(d => yScale(d.sales))
                    .curve(d3.curveMonotoneX);
                grp.append("path").datum(s.values)
                    .attr("fill", "url(#lcBevGrad)").attr("d", areaGen);
            }

            const path = grp.append("path").datum(s.values)
                .attr("fill", "none").attr("stroke", col)
                .attr("stroke-width", s.key === "BEV" ? 2.5 : 2)
                .attr("stroke-dasharray", s.key === "FCEV" ? "6,3" : null)
                .attr("d", lineGen);

            // Draw animation only for solid lines
            if (s.key !== "FCEV") {
                const len = path.node().getTotalLength();
                path.attr("stroke-dasharray", len).attr("stroke-dashoffset", len)
                    .transition().duration(900).ease(d3.easeCubicInOut)
                    .attr("stroke-dashoffset", 0);
            }

            grp.selectAll(".dot").data(s.values).enter().append("circle")
                .attr("class", "dot")
                .attr("cx", d => x(d.year))
                .attr("cy", d => yScale(d.sales))
                .attr("r", 3.5).attr("fill", col)
                .attr("stroke", "#0a0f1a").attr("stroke-width", 1.5)
                .on("mouseover", (event, d) => showTooltip(event,
                    `<strong>${d.year}</strong> · ${s.key}<br>${d3.format(",")(d.sales)} vehicles`))
                .on("mousemove", moveTooltip).on("mouseout", hideTooltip);
        });
    }

    renderSeries();

    // ── Legend ────────────────────────────────────────────────────────────────
    const legendG = svg.append("g")
        .attr("transform", `translate(${m.left + 10}, ${m.top - 14})`);
    allKeys.forEach((k, i) => {
        const col = COLORS[k];
        const lg  = legendG.append("g").attr("transform", `translate(${i * 130}, 0)`);
        lg.append("line").attr("x1", 0).attr("y1", 5).attr("x2", 20).attr("y2", 5)
            .attr("stroke", col)
            .attr("stroke-width", k === "BEV" ? 2.5 : 2)
            .attr("stroke-dasharray", k === "FCEV" ? "6,3" : null);
        lg.append("text").attr("x", 25).attr("y", 9)
            .attr("fill", "#9ca3af").attr("font-size", 13)
            .text(k === "FCEV" ? "FCEV (right axis)" : k);
    });

    // ── Toggle handlers ───────────────────────────────────────────────────────
    controls.querySelectorAll(".ctrl-btn[data-pt]").forEach(btn => {
        btn.addEventListener("click", () => {
            const pt = btn.dataset.pt;
            if (active.has(pt)) {
                if (active.size === 1) return;
                active.delete(pt);
                btn.classList.remove("active");
            } else {
                active.add(pt);
                btn.classList.add("active");
            }
            renderSeries();
        });
    });
}
