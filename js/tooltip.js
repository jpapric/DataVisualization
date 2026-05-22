// Shared tooltip singleton — import getTooltip() in every chart module
let _tip = null;

export function getTooltip() {
    if (!_tip) {
        _tip = d3.select("body").append("div").attr("class", "ev-tooltip");
    }
    return _tip;
}

export function showTooltip(event, html) {
    const tip = getTooltip();
    tip.style("opacity", 1).html(html);
    positionTooltip(event);
}

export function moveTooltip(event) {
    positionTooltip(event);
}

export function hideTooltip() {
    getTooltip().style("opacity", 0);
}

function positionTooltip(event) {
    const tip = getTooltip();
    const node = tip.node();
    const tw = node.offsetWidth || 160;
    const th = node.offsetHeight || 60;
    const margin = 14;

    let left = event.clientX + margin;
    let top  = event.clientY - th / 2;

    // flip left if it overflows right edge
    if (left + tw > window.innerWidth - 8) {
        left = event.clientX - tw - margin;
    }
    // clamp top within viewport
    top = Math.max(8, Math.min(top, window.innerHeight - th - 8));

    tip.style("left", left + "px").style("top", top + "px");
}
