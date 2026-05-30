// data: ev_specs [{brand, model, battery_kWh, range_km, efficiency_wh_km, accel_s, segment}]
export function createComparisonChart(data, containerId = "comparisonChart") {
    const el = document.getElementById(containerId);
    if (!el) return {};

    const valid = data.filter(d => d.battery_kWh && d.range_km);
    const byName = new Map(valid.map(d => [`${d.brand} ${d.model}`, d]));

    el.innerHTML = `
        <div class="cmp-segment-bar" id="cmp-segment-bar">
            <span class="cmp-segment-label" id="cmp-segment-label"></span>
            <button class="cmp-clear-btn" id="cmp-clear-btn">✕ Clear filter</button>
        </div>
        <div class="cmp-selectors">
            <select class="cmp-select" id="cmp-car1">
                <option value="">— Select first car —</option>
            </select>
            <span class="cmp-vs">vs</span>
            <select class="cmp-select" id="cmp-car2">
                <option value="">— Select second car —</option>
            </select>
        </div>
        <div class="cmp-result" id="cmp-result">
            <p class="cmp-hint">Select two cars above to compare their specifications.</p>
        </div>
    `;

    const sel1     = el.querySelector("#cmp-car1");
    const sel2     = el.querySelector("#cmp-car2");
    const result   = el.querySelector("#cmp-result");
    const segBar   = el.querySelector("#cmp-segment-bar");
    const segLabel = el.querySelector("#cmp-segment-label");
    const clearBtn = el.querySelector("#cmp-clear-btn");

    const SPECS = [
        { label: "Battery",    key: "battery_kWh",     unit: "kWh",   higher: true  },
        { label: "Range",      key: "range_km",         unit: "km",    higher: true  },
        { label: "Efficiency", key: "efficiency_wh_km", unit: "Wh/km", higher: false },
        { label: "0–100 km/h", key: "accel_s",          unit: "s",     higher: false },
        { label: "Segment",    key: "segment",          unit: "",      higher: null  },
    ];

    function populateSelects(pool) {
        const prev1 = sel1.value;
        const prev2 = sel2.value;

        const opts = pool.map(d =>
            `<option value="${d.brand} ${d.model}">${d.brand} ${d.model}</option>`
        ).join("");

        sel1.innerHTML = `<option value="">— Select first car —</option>${opts}`;
        sel2.innerHTML = `<option value="">— Select second car —</option>${opts}`;

        // Restore previous selections if they still exist in the filtered pool
        const names = new Set(pool.map(d => `${d.brand} ${d.model}`));
        if (names.has(prev1)) sel1.value = prev1;
        if (names.has(prev2)) sel2.value = prev2;

        // Fall back to top 2 by range from the pool
        if (!sel1.value || !sel2.value) {
            const top2 = [...pool].sort((a, b) => b.range_km - a.range_km).slice(0, 2);
            if (top2[0]) sel1.value = `${top2[0].brand} ${top2[0].model}`;
            if (top2[1]) sel2.value = `${top2[1].brand} ${top2[1].model}`;
        }
    }

    function update() {
        const d1 = byName.get(sel1.value);
        const d2 = byName.get(sel2.value);

        if (!d1 || !d2) {
            result.innerHTML = `<p class="cmp-hint">Select two cars above to compare their specifications.</p>`;
            return;
        }

        const fmt = (v, unit) => v != null ? `${v}${unit ? " " + unit : ""}` : "—";

        const rows = SPECS.map(s => {
            const v1 = d1[s.key];
            const v2 = d2[s.key];
            const numeric = s.higher !== null && v1 != null && v2 != null;
            const win1 = numeric && (s.higher ? v1 > v2 : v1 < v2);
            const win2 = numeric && (s.higher ? v2 > v1 : v2 < v1);
            return `
                <div class="cmp-row">
                    <span class="cmp-val ${win1 ? "cmp-win-left" : ""}">${fmt(v1, s.unit)}</span>
                    <span class="cmp-label">${s.label}</span>
                    <span class="cmp-val ${win2 ? "cmp-win-right" : ""}">${fmt(v2, s.unit)}</span>
                </div>`;
        }).join("");

        result.innerHTML = `
            <div class="cmp-header">
                <span class="cmp-name-left">${d1.brand} ${d1.model}</span>
                <span></span>
                <span class="cmp-name-right">${d2.brand} ${d2.model}</span>
            </div>
            ${rows}`;
    }

    sel1.addEventListener("change", update);
    sel2.addEventListener("change", update);

    //Segment filter (called by scatter plot click) 
    function filterBySegment(segment) {
        const pool = segment
            ? valid.filter(d => (d.segment || "Other") === segment)
                   .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`))
            : [...valid].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));

        if (segment) {
            segBar.style.display = "flex";
            segLabel.textContent = `Showing ${segment} segment only`;
        } else {
            segBar.style.display = "none";
        }

        populateSelects(pool);
        update();
    }

    clearBtn.addEventListener("click", () => filterBySegment(null));

    // Initial state — all cars, top 2 by range pre-selected
    segBar.style.display = "none";
    const allSorted = [...valid].sort((a, b) =>
        `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
    populateSelects(allSorted);
    update();

    return { filterBySegment };
}
