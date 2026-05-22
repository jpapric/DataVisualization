import { createLineChart }    from './lineChart.js';
import { createBarChart }     from './barChart.js';
import { createDivergingBar } from './divergingBar.js';
import { createScatterPlot }  from './scatterPlot.js';
import { createMapChart }     from './mapChart.js';
import { createStackedArea }  from './stackedArea.js';

const DATA = "data/processed/";

async function loadAll() {
    const [salesByYear, topMakers, powertrainByYear, regionYearData, specs, teslaByYear, segmentByYear] =
        await Promise.all([
            d3.json(DATA + "sales_by_year.json"),
            d3.json(DATA + "top_manufacturers.json"),
            d3.json(DATA + "powertrain_by_year.json"),
            d3.json(DATA + "sales_by_region_year.json"),
            d3.json(DATA + "ev_specs.json"),
            d3.json(DATA + "tesla_by_year.json"),
            d3.json(DATA + "segment_by_year.json"),
        ]);
    return { salesByYear, topMakers, powertrainByYear, regionYearData, specs, teslaByYear, segmentByYear };
}

// ── Sparkline ────────────────────────────────────────────────────────────────
function drawSparkline(svgId, data, valueKey, color = "#22c55e") {
    const el = document.getElementById(svgId);
    if (!el) return;
    const W = el.parentElement.offsetWidth + 36;  // full card width (bleeds)
    const H = 60;

    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "none");
    svg.selectAll("*").remove();

    const x = d3.scaleLinear().domain([0, data.length - 1]).range([0, W]);
    const vals = data.map(d => d[valueKey]);
    const y = d3.scaleLinear().domain([d3.min(vals) * 0.95, d3.max(vals) * 1.05]).range([H - 2, 2]);

    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", `sg-${svgId}`).attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",1);
    grad.append("stop").attr("offset","0%").attr("stop-color", color).attr("stop-opacity", 0.35);
    grad.append("stop").attr("offset","100%").attr("stop-color", color).attr("stop-opacity", 0);

    const area = d3.area().x((_, i) => x(i)).y0(H).y1(d => y(d)).curve(d3.curveMonotoneX);
    const line = d3.line().x((_, i) => x(i)).y(d => y(d)).curve(d3.curveMonotoneX);

    svg.append("path").datum(vals).attr("fill", `url(#sg-${svgId})`).attr("d", area);
    svg.append("path").datum(vals)
        .attr("fill","none").attr("stroke", color).attr("stroke-width", 1.8)
        .attr("d", line);
}

// ── KPI helpers ──────────────────────────────────────────────────────────────
function setText(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }

function pctChange(arr, key) {
    if (arr.length < 2) return null;
    const last = arr[arr.length - 1][key];
    const prev = arr[arr.length - 2][key];
    return prev ? ((last - prev) / prev * 100) : null;
}

function setBadge(id, pct, forceColor) {
    const el = document.getElementById(id);
    if (!el || pct === null || isNaN(pct)) return;
    const sign = pct >= 0 ? "▲" : "▼";
    el.textContent = `${sign} ${Math.abs(pct).toFixed(1)}%`;
    el.className = "kpi-badge " + (forceColor || (pct >= 0 ? "positive" : "negative"));
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    let data;
    try { data = await loadAll(); }
    catch (err) { console.error("Failed to load data:", err); return; }

    const { salesByYear, topMakers, powertrainByYear, regionYearData, specs, teslaByYear, segmentByYear } = data;

    // ── KPI values ──
    const latestSales = salesByYear[salesByYear.length - 1];
    setText("kpi-sales",    d3.format(".3s")(latestSales?.sales ?? 0).replace("G","B"));
    setText("kpi-year",     latestSales?.year ?? "");
    setText("kpi-top-make", topMakers[0]?.make ?? "");
    setText("kpi-avg-range", Math.round(d3.mean(specs, d => d.range_km)) + " km");

    // BEV share for latest year
    const bevRows = powertrainByYear.filter(d => d.powertrain === "BEV");
    const allRows = powertrainByYear;
    const latestYr = d3.max(powertrainByYear, d => d.year);
    const bevLatest = d3.sum(powertrainByYear.filter(d => d.year === latestYr && d.powertrain === "BEV"), d => d.sales);
    const allLatest = d3.sum(powertrainByYear.filter(d => d.year === latestYr), d => d.sales);
    setText("kpi-bev-share", Math.round(bevLatest / allLatest * 100) + "%");

    // ── KPI badges ──
    setBadge("kpi-sales-change", pctChange(salesByYear, "sales"));
    setBadge("kpi-make-change",  pctChange(teslaByYear,  "count"));
    const bevPrev = d3.sum(powertrainByYear.filter(d => d.year === latestYr - 1 && d.powertrain === "BEV"), d => d.sales);
    const allPrev = d3.sum(powertrainByYear.filter(d => d.year === latestYr - 1), d => d.sales);
    const bevSharePrev   = allPrev   > 0 ? bevPrev   / allPrev   : null;
    const bevShareLatest = allLatest > 0 ? bevLatest / allLatest : null;
    setBadge("kpi-bev-change", bevShareLatest !== null && bevSharePrev !== null
        ? (bevShareLatest - bevSharePrev) * 100 : null);

    // ── Sparklines ──
    drawSparkline("spark-sales", salesByYear,  "sales",  "#22c55e");
    drawSparkline("spark-make",  teslaByYear,  "count",  "#06b6d4");
    drawSparkline("spark-bev",   bevRows.sort((a,b) => a.year - b.year), "sales", "#f97316");

    // ── Lazy chart rendering ──
    const rendered = new Set();

    function renderTab(tab) {
        if (rendered.has(tab)) return;
        rendered.add(tab);

        if (tab === "overview") {
            createLineChart(powertrainByYear, "lineChart");
        } else if (tab === "manufacturers") {
            createBarChart(topMakers, "barChart");
        } else if (tab === "technical") {
            createDivergingBar(specs, "divergingBar");
            createScatterPlot(specs, "scatterPlot");
        } else if (tab === "geography") {
            createMapChart(regionYearData, "mapChart");
        } else if (tab === "timeline") {
            createStackedArea(segmentByYear, "heatmap");
        }
    }

    renderTab("overview");

    // ── Tab switching ──
    document.querySelectorAll(".ev-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll(".ev-tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".ev-tab-panel").forEach(p => p.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById("panel-" + tab)?.classList.add("active");
            setTimeout(() => renderTab(tab), 50);
        });
    });
}

init();
