import { showTooltip, moveTooltip, hideTooltip } from './tooltip.js';

// data: ev_specs array [{brand, model, battery_kWh, range_km, efficiency_wh_km, accel_s}]
export function createDivergingBar(data, containerId = "divergingBar") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const W = rect.width || 860;

    const top = [...data]
        .filter(d => d.battery_kWh && d.range_km)
        .sort((a, b) => b.range_km - a.range_km)
        .slice(0, 12);

    const ROW_H   = 46;
    const PAD_TOP = 44;
    const PAD_BOT = 16;
    const chartH  = PAD_TOP + top.length * ROW_H + PAD_BOT;

    // ── Layout ───────────────────────────────────────────────────────
    // [NAME_W][NAME_PAD][BAT_VAL][←battery zone ZONE_W][CENTER][range zone ZONE_W→][RNG_TRAIL][ACCEL_W]
    const NAME_W    = 220;
    const NAME_PAD  = 10;
    const BAT_VAL   = 34;   // space for battery value label
    const RNG_TRAIL = 44;   // space for range value label
    const ACCEL_W   = 64;
    const ZONE_W    = (W - NAME_W - NAME_PAD - BAT_VAL - RNG_TRAIL - ACCEL_W) / 2;

    const cx       = NAME_W + NAME_PAD + BAT_VAL + ZONE_W;  // shared centre axis
    const batValX  = cx - ZONE_W - 4;   // battery value right-aligned here
    const rngValX  = cx + ZONE_W + 6;   // range value left-aligned here

    const maxBattery = d3.max(top, d => d.battery_kWh);
    const maxRange   = d3.max(top, d => d.range_km);
    const xBat = d3.scaleLinear().domain([0, maxBattery]).range([0, ZONE_W]);
    const xRng = d3.scaleLinear().domain([0, maxRange]).range([0, ZONE_W]);

    container.parentElement.style.height = chartH + "px";

    const svg = d3.select(container)
        .attr("viewBox", `0 0 ${W} ${chartH}`)
        .attr("preserveAspectRatio", "none");
    svg.selectAll("*").remove();

    // ── Headers ──────────────────────────────────────────────────────
    svg.append("text")
        .attr("x", cx - ZONE_W / 2).attr("y", 22)
        .attr("text-anchor", "middle").attr("fill", "#22c55e")
        .attr("font-size", 13).attr("font-weight", "700").attr("letter-spacing", "0.06em")
        .text("BATTERY (KWH)");

    svg.append("text")
        .attr("x", cx + ZONE_W / 2).attr("y", 22)
        .attr("text-anchor", "middle").attr("fill", "#06b6d4")
        .attr("font-size", 13).attr("font-weight", "700").attr("letter-spacing", "0.06em")
        .text("RANGE (KM)");

    svg.append("text")
        .attr("x", W - 4).attr("y", 22)
        .attr("text-anchor", "end").attr("fill", "#9ca3af")
        .attr("font-size", 13).attr("font-weight", "700").attr("letter-spacing", "0.06em")
        .text("0–100 (S)");

    svg.append("line")
        .attr("x1", 0).attr("y1", PAD_TOP - 6)
        .attr("x2", W).attr("y2", PAD_TOP - 6)
        .attr("stroke", "#1f2937").attr("stroke-width", 1);

    // ── Rows ─────────────────────────────────────────────────────────
    top.forEach((d, i) => {
        const rowY = PAD_TOP + i * ROW_H;
        const midY = rowY + ROW_H / 2;

        if (i % 2 === 0) {
            svg.append("rect")
                .attr("x", 0).attr("y", rowY)
                .attr("width", W).attr("height", ROW_H)
                .attr("fill", "#0f1623").attr("opacity", 0.55);
        }

        // Name + efficiency
        svg.append("text")
            .attr("x", 6).attr("y", midY - 3)
            .attr("text-anchor", "start").attr("fill", "#f9fafb")
            .attr("font-size", 13).attr("font-weight", "600")
            .text(`${d.brand} ${d.model}`.slice(0, 24));

        if (d.efficiency_wh_km) {
            svg.append("text")
                .attr("x", 6).attr("y", midY + 11)
                .attr("text-anchor", "start").attr("fill", "#22c55e").attr("font-size", 11)
                .text(`${(1000 / d.efficiency_wh_km).toFixed(1)} km/kWh`);
        }

        // Battery value + bar growing LEFT from centre
        const bW = xBat(d.battery_kWh);

        svg.append("text")
            .attr("x", batValX).attr("y", midY + 4)
            .attr("text-anchor", "end").attr("fill", "#9ca3af").attr("font-size", 12)
            .attr("opacity", 0)
            .text(d.battery_kWh)
            .transition().duration(700).delay(i * 40 + 300).attr("opacity", 1);

        const GAP = 3;  // space between the two bars at centre

        svg.append("rect")
            .attr("x", cx - GAP).attr("y", midY - 7)
            .attr("width", 0).attr("height", 14).attr("rx", 3)
            .attr("fill", "#22c55e").attr("opacity", 0.85)
            .on("mouseover", e => showTooltip(e,
                `<strong>${d.brand} ${d.model}</strong><br>Battery: ${d.battery_kWh} kWh`))
            .on("mousemove", moveTooltip).on("mouseout", hideTooltip)
            .transition().duration(700).delay(i * 40).ease(d3.easeCubicOut)
            .attr("x", cx - GAP - bW)
            .attr("width", bW);

        // Range bar growing RIGHT from centre + value
        const rW = xRng(d.range_km);

        svg.append("rect")
            .attr("x", cx + GAP).attr("y", midY - 7)
            .attr("width", 0).attr("height", 14).attr("rx", 3)
            .attr("fill", "#06b6d4").attr("opacity", 0.85)
            .on("mouseover", e => showTooltip(e,
                `<strong>${d.brand} ${d.model}</strong><br>Range: ${d.range_km} km`))
            .on("mousemove", moveTooltip).on("mouseout", hideTooltip)
            .transition().duration(700).delay(i * 40).ease(d3.easeCubicOut)
            .attr("width", rW);

        svg.append("text")
            .attr("x", rngValX).attr("y", midY + 4)
            .attr("text-anchor", "start").attr("fill", "#9ca3af").attr("font-size", 12)
            .attr("opacity", 0)
            .text(d.range_km)
            .transition().duration(700).delay(i * 40 + 300).attr("opacity", 1);

        // Acceleration
        if (d.accel_s) {
            svg.append("text")
                .attr("x", W - 4).attr("y", midY + 4)
                .attr("text-anchor", "end").attr("fill", "#f97316").attr("font-size", 12)
                .text(`${d.accel_s}s`);
        }
    });

    // ── Separator lines ───────────────────────────────────────────────
    const y1 = PAD_TOP - 2, y2 = PAD_TOP + top.length * ROW_H;

    // After name column
    svg.append("line")
        .attr("x1", NAME_W - 14).attr("y1", y1).attr("x2", NAME_W - 14).attr("y2", y2)
        .attr("stroke", "#1f2937").attr("stroke-width", 1);

    // Shared centre axis
    svg.append("line")
        .attr("x1", cx).attr("y1", y1).attr("x2", cx).attr("y2", y2)
        .attr("stroke", "#374151").attr("stroke-width", 1);

    // Before accel column
    svg.append("line")
        .attr("x1", rngValX + 34).attr("y1", y1).attr("x2", rngValX + 34).attr("y2", y2)
        .attr("stroke", "#1f2937").attr("stroke-width", 1);
}
