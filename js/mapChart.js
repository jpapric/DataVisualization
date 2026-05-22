import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

const REGION_TO_ISO = {
    "Australia":"AUS","Austria":"AUT","Belgium":"BEL","Brazil":"BRA",
    "Canada":"CAN","Chile":"CHL","China":"CHN","Colombia":"COL",
    "Croatia":"HRV","Czech Republic":"CZE","Denmark":"DNK",
    "Finland":"FIN","France":"FRA","Germany":"DEU","Greece":"GRC",
    "Hungary":"HUN","Iceland":"ISL","India":"IND","Indonesia":"IDN",
    "Ireland":"IRL","Israel":"ISR","Italy":"ITA","Japan":"JPN",
    "Korea":"KOR","Mexico":"MEX","Netherlands":"NLD",
    "New Zealand":"NZL","Norway":"NOR","Poland":"POL","Portugal":"PRT",
    "Romania":"ROU","Slovakia":"SVK","Slovenia":"SVN","South Africa":"ZAF",
    "Spain":"ESP","Sweden":"SWE","Switzerland":"CHE","Thailand":"THA",
    "Turkey":"TUR","United Kingdom":"GBR","United States of America":"USA",
    "USA":"USA","UK":"GBR"
};

const NUMERIC_TO_ISO3 = {
    4:"AFG",8:"ALB",12:"DZA",24:"AGO",32:"ARG",36:"AUS",40:"AUT",
    50:"BGD",56:"BEL",64:"BTN",68:"BOL",76:"BRA",100:"BGR",104:"MMR",
    116:"KHM",120:"CMR",124:"CAN",144:"LKA",152:"CHL",156:"CHN",
    170:"COL",188:"CRI",191:"HRV",196:"CYP",203:"CZE",208:"DNK",
    214:"DOM",218:"ECU",818:"EGY",222:"SLV",231:"ETH",233:"EST",
    246:"FIN",250:"FRA",266:"GAB",276:"DEU",288:"GHA",300:"GRC",
    320:"GTM",332:"HTI",340:"HND",348:"HUN",352:"ISL",356:"IND",
    360:"IDN",364:"IRN",368:"IRQ",372:"IRL",376:"ISR",380:"ITA",
    388:"JAM",392:"JPN",398:"KAZ",400:"JOR",404:"KEN",408:"PRK",
    410:"KOR",414:"KWT",418:"LAO",422:"LBN",428:"LVA",440:"LTU",
    442:"LUX",450:"MDG",458:"MYS",484:"MEX",496:"MNG",504:"MAR",
    516:"NAM",524:"NPL",528:"NLD",554:"NZL",566:"NGA",578:"NOR",
    586:"PAK",591:"PAN",598:"PNG",600:"PRY",604:"PER",608:"PHL",
    616:"POL",620:"PRT",634:"QAT",642:"ROU",643:"RUS",682:"SAU",
    686:"SEN",703:"SVK",705:"SVN",710:"ZAF",716:"ZWE",724:"ESP",
    736:"SDN",752:"SWE",756:"CHE",760:"SYR",764:"THA",788:"TUN",
    792:"TUR",800:"UGA",804:"UKR",784:"ARE",826:"GBR",834:"TZA",
    840:"USA",858:"URY",860:"UZB",862:"VEN",704:"VNM",887:"YEM",894:"ZMB"
};

// regionYearData: [{region, year, sales}] — full multi-year dataset
export async function createMapChart(regionYearData, containerId = "mapChart") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const W = rect.width  || 1000;
    const H = rect.height || 560;

    // ── Year slider ───────────────────────────────────────────────────
    const years = [...new Set(regionYearData.map(d => d.year))].sort((a, b) => a - b);
    let currentYear = years[years.length - 1];

    const sliderWrap = document.createElement("div");
    sliderWrap.className = "map-year-wrap";
    sliderWrap.innerHTML = `
        <span class="map-year-label">Year</span>
        <input type="range" class="map-year-slider"
               min="${years[0]}" max="${years[years.length - 1]}"
               value="${currentYear}" step="1">
        <span class="map-year-val">${currentYear}</span>
    `;
    container.parentElement.insertBefore(sliderWrap, container);

    const slider   = sliderWrap.querySelector(".map-year-slider");
    const yearVal  = sliderWrap.querySelector(".map-year-val");

    function getSalesMap(year) {
        const map = new Map();
        regionYearData
            .filter(d => d.year === year)
            .forEach(d => {
                const iso = REGION_TO_ISO[d.region];
                if (iso) map.set(iso, (map.get(iso) || 0) + d.sales);
            });
        return map;
    }

    let salesMap = getSalesMap(currentYear);

    // ── SVG setup ────────────────────────────────────────────────────
    const svg = d3.select(container)
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("preserveAspectRatio", "none")
        .style("cursor", "pointer");
    svg.selectAll("*").remove();

    const bgRect  = svg.append("rect").attr("width", W).attr("height", H).attr("fill", "#070d18").style("cursor", "default");
    const g       = svg.append("g");
    const overlay = svg.append("g");

    // ── Zoom ─────────────────────────────────────────────────────────
    const zoom = d3.zoom()
        .scaleExtent([1, 12])
        .on("zoom", event => g.attr("transform", event.transform));
    svg.call(zoom).on("dblclick.zoom", null);

    function resetZoom() {
        hideTooltip();
        overlay.selectAll("*").remove();
        g.selectAll("path").attr("stroke", "#0d1a2e").attr("stroke-width", 0.4);
        svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity);
    }
    bgRect.on("click", resetZoom);

    // ── Load world topology ───────────────────────────────────────────
    let world;
    try {
        world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
    } catch {
        svg.append("text").attr("x", W / 2).attr("y", H / 2)
            .attr("text-anchor", "middle").attr("fill", "#4b5563").attr("font-size", 14)
            .text("Map requires internet connection");
        return;
    }

    const countries  = topojson.feature(world, world.objects.countries);
    const projection = d3.geoNaturalEarth1().fitSize([W, H - 40], countries);
    const path       = d3.geoPath().projection(projection);

    function makeColorScale(sMap) {
        const vals = [...sMap.values()];
        if (!vals.length) return () => "#1a2235";
        const mn = d3.min(vals), mx = d3.max(vals);
        return d3.scaleSequentialLog([mn || 1, mx], d3.interpolate("#1e5c32", "#22c55e"));
    }

    let colorScale = makeColorScale(salesMap);

    // ── Country paths ─────────────────────────────────────────────────
    g.selectAll("path")
        .data(countries.features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", d => {
            const iso = NUMERIC_TO_ISO3[+d.id];
            return salesMap.get(iso) ? colorScale(salesMap.get(iso)) : "#1a2235";
        })
        .attr("stroke", "#0d1a2e").attr("stroke-width", 0.4)
        .on("mouseover", (event, d) => {
            const iso   = NUMERIC_TO_ISO3[+d.id];
            const sales = salesMap.get(iso);
            const name  = Object.keys(REGION_TO_ISO).find(k => REGION_TO_ISO[k] === iso) || iso || "Unknown";
            d3.select(event.currentTarget).attr("stroke", "#22c55e").attr("stroke-width", 1);
            showTooltip(event, sales
                ? `<strong>${name}</strong> · ${currentYear}<br>${d3.format(",")(sales)} EVs sold`
                : `<strong>${name}</strong><br>No data`);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", event => {
            d3.select(event.currentTarget).attr("stroke", "#0d1a2e").attr("stroke-width", 0.4);
            hideTooltip();
        })
        .on("click", (event, d) => {
            event.stopPropagation();
            hideTooltip();

            const iso   = NUMERIC_TO_ISO3[+d.id];
            const sales = salesMap.get(iso);
            const name  = Object.keys(REGION_TO_ISO).find(k => REGION_TO_ISO[k] === iso) || iso || "Unknown";
            const total = d3.sum([...salesMap.values()]);

            const [[x0, y0], [x1, y1]] = path.bounds(d);
            const scale = Math.min(10, 0.82 / Math.max((x1 - x0) / W, (y1 - y0) / H));
            const tx = W / 2 - scale * (x0 + x1) / 2;
            const ty = H / 2 - scale * (y0 + y1) / 2;
            const t  = d3.zoomIdentity.translate(tx, ty).scale(scale);

            g.selectAll("path").attr("stroke", "#0d1a2e").attr("stroke-width", 0.4);
            d3.select(event.currentTarget).attr("stroke", "#22c55e").attr("stroke-width", 1.5 / scale);
            svg.transition().duration(750).call(zoom.transform, t);

            overlay.selectAll("*").remove();
            const [cx, cy] = path.centroid(d);
            const sx = Math.max(84, Math.min(W - 84, t.applyX(cx)));
            const sy = Math.max(32, Math.min(H - 32, t.applyY(cy)));
            const pW = 168, pH = 56;

            overlay.append("rect")
                .attr("x", sx - pW / 2).attr("y", sy - pH / 2)
                .attr("width", pW).attr("height", pH).attr("rx", 7)
                .attr("fill", "#0b1420").attr("fill-opacity", 0.92)
                .attr("stroke", "#22c55e").attr("stroke-width", 1).attr("opacity", 0)
                .transition().delay(680).duration(220).attr("opacity", 1);
            overlay.append("text")
                .attr("x", sx).attr("y", sy - pH / 2 + 20)
                .attr("text-anchor", "middle").attr("fill", "#f9fafb")
                .attr("font-size", 13).attr("font-weight", "700").attr("opacity", 0)
                .text(name)
                .transition().delay(700).duration(200).attr("opacity", 1);
            overlay.append("text")
                .attr("x", sx).attr("y", sy - pH / 2 + 38)
                .attr("text-anchor", "middle")
                .attr("fill", sales ? "#22c55e" : "#4b5563")
                .attr("font-size", 12).attr("opacity", 0)
                .text(sales
                    ? `${d3.format(",")(sales)} EVs · ${((sales / total) * 100).toFixed(1)}%`
                    : "No data")
                .transition().delay(730).duration(200).attr("opacity", 1);
        });

    // ── Year slider handler ───────────────────────────────────────────
    slider.addEventListener("input", e => {
        currentYear = +e.target.value;
        yearVal.textContent = currentYear;
        salesMap   = getSalesMap(currentYear);
        colorScale = makeColorScale(salesMap);

        overlay.selectAll("*").remove();
        svg.call(zoom.transform, d3.zoomIdentity);

        g.selectAll("path")
            .transition().duration(350)
            .attr("fill", d => {
                const iso = NUMERIC_TO_ISO3[+d.id];
                return salesMap.get(iso) ? colorScale(salesMap.get(iso)) : "#1a2235";
            });
    });

    // ── Legend ────────────────────────────────────────────────────────
    const legendW = 140, legendH = 8;
    const lx = W - legendW - 16, ly = H - 28;
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "mapGrad");
    d3.range(0, 1.01, 0.1).forEach(t => {
        grad.append("stop").attr("offset", `${t * 100}%`)
            .attr("stop-color", d3.interpolate("#1e5c32", "#22c55e")(t));
    });
    svg.append("rect").attr("x", lx).attr("y", ly)
        .attr("width", legendW).attr("height", legendH)
        .attr("rx", 2).attr("fill", "url(#mapGrad)");
    svg.append("text").attr("x", lx).attr("y", ly - 4)
        .attr("fill", "#6b7280").attr("font-size", 11).text("Low");
    svg.append("text").attr("x", lx + legendW).attr("y", ly - 4)
        .attr("text-anchor", "end").attr("fill", "#6b7280").attr("font-size", 11)
        .text("High EV Sales");

    svg.append("text").attr("x", 10).attr("y", H - 10)
        .attr("fill", "#374151").attr("font-size", 11)
        .text("Click a country to zoom · Click ocean to reset");
}
