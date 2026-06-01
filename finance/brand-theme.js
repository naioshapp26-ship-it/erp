(function () {
    function applyChartPalette(config) {
        if (!config || !config.data || !Array.isArray(config.data.datasets)) {
            return config;
        }
        const palette = ['#000000', '#ef4444', '#64748b'];
        config.data.datasets = config.data.datasets.map((dataset, index) => {
            const safeIndex = index % palette.length;
            const nextColor = palette[safeIndex];
            const overrides = {};

            if (Array.isArray(dataset.backgroundColor)) {
                overrides.backgroundColor = dataset.backgroundColor.map((_, i) => palette[i % palette.length]);
            } else if (dataset.backgroundColor) {
                overrides.backgroundColor = nextColor;
            }

            if (Array.isArray(dataset.borderColor)) {
                overrides.borderColor = dataset.borderColor.map((_, i) => palette[i % palette.length]);
            } else if (dataset.borderColor) {
                overrides.borderColor = nextColor;
            }

            return Object.assign({}, dataset, overrides);
        });
        return config;
    }

    function patchChart() {
        if (!window.Chart || window.Chart.__brandPatched) return;
        window.Chart.__brandPatched = true;

        window.Chart.defaults.color = '#000000';
        window.Chart.defaults.borderColor = '#000000';

        const OriginalChart = window.Chart;
        window.Chart = function (ctx, config) {
            const updatedConfig = applyChartPalette(config);
            return new OriginalChart(ctx, updatedConfig);
        };
        window.Chart.prototype = OriginalChart.prototype;
        Object.assign(window.Chart, OriginalChart);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patchChart);
    } else {
        patchChart();
    }
})();
