import React, { useEffect, useRef } from 'react';
import { Card } from 'react-bootstrap';
import * as d3 from 'd3';

interface ProductClusterChartProps {
    clusters: any;
    onProductSelect?: (product: any) => void;
}

const theme = {
    card: '#ffffff',
    border: '#ebe4d8',
    text: '#223127',
    muted: '#6f7a71',
    green: '#2f6b3a',
    greenSoft: '#dfeadf',
    shadow: '0 14px 35px rgba(34, 49, 39, 0.08)'
};

function getScore(product: any) {
    return Number(
        product.individualScore ??
        product.computedRating ??
        product.scoreFinal ??
        product.finalScore ??
        product.score ??
        0
    );
}

function getProductName(product: any) {
    return product.productName || product.fullProductName || product.name || product.objectName || 'Продукт';
}

function formatPrice(product: any) {
    const raw = product.price;

    if (typeof raw === 'number') return `${raw.toFixed(0)} руб`;

    if (raw && typeof raw === 'object') {
        const whole = raw.whole ?? raw.wholepart ?? 0;
        const copecks = raw.copecks ?? 0;
        return copecks ? `${whole} руб ${copecks} коп` : `${whole} руб`;
    }

    if (product.wholepart !== undefined) {
        const whole = product.wholepart ?? 0;
        const copecks = product.copecks ?? 0;
        return copecks ? `${whole} руб ${copecks} коп` : `${whole} руб`;
    }

    return '—';
}

const ProductClusterChart: React.FC<ProductClusterChartProps> = ({ clusters, onProductSelect }) => {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current) return;

        d3.select(chartRef.current).selectAll('*').remove();

        if (!clusters || !clusters.clusters || clusters.clusters.length === 0) return;

        const rawProducts: any[] = [];

        clusters.clusters.forEach((cluster: any) => {
            const products = Array.isArray(cluster.products) ? cluster.products : [];

            products.forEach((product: any) => {
                rawProducts.push({
                    ...product,
                    clusterRank: product.clusterRank ?? cluster.rank ?? 0,
                    clusterColor: product.clusterRankColor ?? cluster.rankColor ?? '#2f6b3a',
                    clusterId: product.clusterId ?? cluster.id ?? 0,
                    clusterRankScore: product.clusterRankScore ?? cluster.rankScore ?? 0
                });
            });
        });

        if (rawProducts.length === 0) return;

        const maxDistance = Math.max(...rawProducts.map((p) => Number(p.distance || 0)), 1);

        const allProducts = rawProducts.map((product) => ({
            ...product,
            x: Number.isFinite(Number(product.x))
                ? Number(product.x)
                : Math.max(0, Math.min(100, (Number(product.distance || 0) / maxDistance) * 100)),
            y: Number.isFinite(Number(product.y))
                ? Number(product.y)
                : Math.max(0, Math.min(100, getScore(product)))
        }));

        const margin = { top: 22, right: 150, bottom: 38, left: 42 };
        const width = 720 - margin.left - margin.right;
        const height = 470 - margin.top - margin.bottom;

        const svg = d3.select(chartRef.current)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .style('overflow', 'visible')
            .style('cursor', 'grab');

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const xValues = allProducts.map((p) => p.x);
        const yValues = allProducts.map((p) => p.y);

        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);

        const xPadding = Math.max((xMax - xMin) * 0.08, 5);
        const yPadding = Math.max((yMax - yMin) * 0.08, 5);

        const xScale = d3.scaleLinear()
            .domain([Math.max(0, xMin - xPadding), Math.min(100, xMax + xPadding)])
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([Math.max(0, yMin - yPadding), Math.min(100, yMax + yPadding)])
            .range([height, 0]);

        let currentXScale = xScale.copy();
        let currentYScale = yScale.copy();

        const xAxisGroup = g.append('g')
            .attr('transform', `translate(0,${height})`)
            .attr('class', 'x-axis');

        const yAxisGroup = g.append('g')
            .attr('class', 'y-axis');

        const gridGroup = g.append('g').attr('class', 'grid');
        const pointsGroup = g.append('g').attr('class', 'points-group');

        const tooltip = d3.select(chartRef.current)
            .append('div')
            .style('position', 'absolute')
            .style('background', 'white')
            .style('padding', '10px 12px')
            .style('border', `1px solid ${theme.border}`)
            .style('border-radius', '12px')
            .style('box-shadow', '0 8px 22px rgba(0,0,0,0.14)')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', 1000)
            .style('font-size', '12px')
            .style('max-width', '290px')
            .style('line-height', '1.45');

        const renderAxes = () => {
            xAxisGroup.call(d3.axisBottom(currentXScale).ticks(5) as any);
            yAxisGroup.call(d3.axisLeft(currentYScale).ticks(5) as any);

            gridGroup.selectAll('*').remove();
            gridGroup
                .append('g')
                .attr('opacity', 0.12)
                .call(d3.axisLeft(currentYScale).tickSize(-width).tickFormat(() => '') as any);
        };

        const updateChart = () => {
            renderAxes();
            pointsGroup.selectAll('circle')
                .attr('cx', (d: any) => currentXScale(d.x))
                .attr('cy', (d: any) => currentYScale(d.y));
        };

        renderAxes();

        g.append('text')
            .attr('x', width / 2)
            .attr('y', height + 34)
            .attr('text-anchor', 'middle')
            .style('fill', theme.muted)
            .style('font-size', '11px')
            .text('Расстояние / географическая близость');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -30)
            .attr('text-anchor', 'middle')
            .style('fill', theme.muted)
            .style('font-size', '11px')
            .text('Итоговая оценка');

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 10])
            .extent([[0, 0], [width + margin.left + margin.right, height + margin.top + margin.bottom]])
            .on('zoom', (event) => {
                currentXScale = event.transform.rescaleX(xScale);
                currentYScale = event.transform.rescaleY(yScale);
                updateChart();
            });

        svg.call(zoom as any);

        pointsGroup.selectAll('circle')
            .data(allProducts)
            .enter()
            .append('circle')
            .attr('cx', (d: any) => currentXScale(d.x))
            .attr('cy', (d: any) => currentYScale(d.y))
            .attr('r', 8)
            .attr('fill', (d: any) => d.clusterColor)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('cursor', 'pointer')
            .attr('opacity', 0.86)
            .on('mouseover', function (event, d: any) {
                d3.select(this).attr('r', 12).attr('opacity', 1).attr('stroke', '#111');

                const distance = d.distance !== undefined && d.distance !== null ? Number(d.distance).toFixed(1) : '—';
                const farmerRating = d.farmerRating !== undefined && d.farmerRating !== null ? Number(d.farmerRating).toFixed(1) : '—';
                const productRating = d.productRating !== undefined && d.productRating !== null ? Number(d.productRating).toFixed(1) : '—';
                const score = getScore(d).toFixed(1);

                tooltip.transition().duration(150).style('opacity', 0.96);
                tooltip.html(`
                    <div style="font-weight: 800; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; color: ${theme.text};">
                        ${getProductName(d)}
                    </div>
                    <div style="color: ${theme.green}; margin-bottom: 4px; font-weight: 600;">${d.farmerName || 'Фермер'}</div>
                    <div>Расстояние: ${distance} км</div>
                    <div>Рейтинг фермера: ${farmerRating}</div>
                    <div>Рейтинг товара: ${productRating}</div>
                    <div>Цена: ${formatPrice(d)}</div>
                    <div>Оценка: ${score}/100</div>
                    <div style="margin-top: 4px; color: ${d.clusterColor}; font-weight: 700;">Кластер #${d.clusterRank || '—'}</div>
                `)
                    .style('left', `${event.offsetX + 18}px`)
                    .style('top', `${event.offsetY + 12}px`);
            })
            .on('mouseout', function () {
                d3.select(this).attr('r', 8).attr('opacity', 0.86).attr('stroke', '#fff');
                tooltip.transition().duration(220).style('opacity', 0);
            })
            .on('click', (_event, d: any) => {
                if (onProductSelect) onProductSelect(d);
            });

        const legend = g.append('g')
            .attr('transform', `translate(${width + 18}, 2)`)
            .style('pointer-events', 'none');

      
        return () => {
            d3.select(chartRef.current).selectAll('*').remove();
        };
    }, [clusters, onProductSelect]);

    if (!clusters || !clusters.clusters || clusters.clusters.length === 0) {
        return (
            <Card className="border-0 h-100" style={{ borderRadius: 26, boxShadow: theme.shadow }}>
                <Card.Body className="d-flex align-items-center justify-content-center text-center" style={{ minHeight: 500 }}>
                    <p className="mb-0" style={{ color: theme.muted }}>Нет данных для построения графика продукции</p>
                </Card.Body>
            </Card>
        );
    }

    return (
        <Card className="border-0 h-100" style={{ borderRadius: 26, boxShadow: theme.shadow, overflow: 'hidden' }}>
            <Card.Body className="p-3">
                <div className="mb-2">
                    <h5 style={{ color: theme.text, fontWeight: 950, marginBottom: 2 }}>Кластеризация продукции</h5>
                    <div style={{ color: theme.muted, fontSize: '0.9rem' }}>
                        Точки показывают товары, цвет отражает принадлежность к кластеру
                    </div>
                </div>
                <div ref={chartRef} style={{ minHeight: 500, position: 'relative', overflowX: 'auto' }} />
            </Card.Body>
        </Card>
    );
};

export default ProductClusterChart;


// import React, { useRef, useEffect } from 'react';
// import { Card } from 'react-bootstrap';
// import * as d3 from 'd3';

// interface ProductClusterChartProps {
//   clusters: any;
//   onProductSelect?: (product: any) => void;
// }

// const ProductClusterChart: React.FC<ProductClusterChartProps> = ({ clusters, onProductSelect }) => {
//   const chartRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     if (!clusters || !clusters.clusters || clusters.clusters.length === 0) return;

//     d3.select(chartRef.current).selectAll('*').remove();

//     // Увеличенные размеры графика
//     const margin = { top: 20, right: 160, bottom: 30, left: 30 };
//     const width = 700 - margin.left - margin.right;
//     const height = 450 - margin.top - margin.bottom;

//     const svg = d3.select(chartRef.current)
//       .append('svg')
//       .attr('width', width + margin.left + margin.right)
//       .attr('height', height + margin.top + margin.bottom)
//       .style('overflow', 'visible')
//       .style('cursor', 'grab');

//     const g = svg.append('g')
//       .attr('transform', `translate(${margin.left},${margin.top})`);

//     // Собираем все продукты
//     const allProducts: any[] = [];
//     clusters.clusters.forEach((cluster: any) => {
//       if (cluster.products && Array.isArray(cluster.products)) {
//         cluster.products.forEach((product: any) => {
//           if (product) {
//             allProducts.push({
//               ...product,
//               clusterRank: cluster.rank || 0,
//               clusterColor: cluster.rankColor || '#cccccc',
//               clusterId: cluster.id || 0,
//               x: product.x !== undefined ? product.x : 50,
//               y: product.y !== undefined ? product.y : 50
//             });
//           }
//         });
//       }
//     });

//     if (allProducts.length === 0) return;

//     const xValues = allProducts.map(p => p.x).filter((x): x is number => x !== undefined);
//     const yValues = allProducts.map(p => p.y).filter((y): y is number => y !== undefined);

//     const xMin = Math.min(...xValues);
//     const xMax = Math.max(...xValues);
//     const yMin = Math.min(...yValues);
//     const yMax = Math.max(...yValues);

//     const xPadding = (xMax - xMin) * 0.05;
//     const yPadding = (yMax - yMin) * 0.05;

//     const xScale = d3.scaleLinear()
//       .domain([Math.max(0, xMin - xPadding), Math.min(100, xMax + xPadding)])
//       .range([0, width]);

//     const yScale = d3.scaleLinear()
//       .domain([Math.max(0, yMin - yPadding), Math.min(100, yMax + yPadding)])
//       .range([height, 0]);

//     let currentXScale = xScale.copy();
//     let currentYScale = yScale.copy();

//     const pointsGroup = g.append('g').attr('class', 'points-group');

//     function updateChart() {
//       pointsGroup.selectAll('circle')
//         .attr('cx', (d: any) => currentXScale(d.x))
//         .attr('cy', (d: any) => currentYScale(d.y));
//     }

//     const zoom = d3.zoom<SVGSVGElement, unknown>()
//       .scaleExtent([0.5, 10])
//       .on('zoom', (event) => {
//         currentXScale = event.transform.rescaleX(xScale);
//         currentYScale = event.transform.rescaleY(yScale);
//         updateChart();
//       });

//     svg.call(zoom as any);

//     // Создаем тултип
//     const tooltip = d3.select(chartRef.current)
//       .append('div')
//       .style('position', 'absolute')
//       .style('background', 'white')
//       .style('padding', '10px 12px')
//       .style('border', '1px solid #ddd')
//       .style('border-radius', '8px')
//       .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
//       .style('pointer-events', 'none')
//       .style('opacity', 0)
//       .style('z-index', 1000)
//       .style('font-size', '12px')
//       .style('max-width', '280px')
//       .style('line-height', '1.4');

//     // Добавляем точки
//     pointsGroup.selectAll('circle')
//       .data(allProducts)
//       .enter()
//       .append('circle')
//       .attr('cx', (d: any) => currentXScale(d.x))
//       .attr('cy', (d: any) => currentYScale(d.y))
//       .attr('r', 8)
//       .attr('fill', (d: any) => d.clusterColor)
//       .attr('stroke', '#fff')
//       .attr('stroke-width', 2)
//       .attr('cursor', 'pointer')
//       .attr('opacity', 0.85)
//       .on('mouseover', function(event, d: any) {
//         d3.select(this).attr('r', 12).attr('opacity', 1).attr('stroke', '#000');
        
//         const distance = d.distance ? d.distance.toFixed(1) : 'Н/Д';
//         const farmerRating = d.farmerRating ? d.farmerRating.toFixed(1) : 'Н/Д';
//         const productRating = d.productRating ? d.productRating.toFixed(1) : 'Н/Д';
//         const price = d.price ? `${d.price.whole || 0} руб ${d.price.copecks || 0} коп` : 'Н/Д';
        
//         tooltip.transition().duration(200).style('opacity', 0.95);
//         tooltip.html(`
//           <div style="font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px;">
//             ${d.name || 'Продукт'}
//           </div>
//           <div style="color: #2e7d32; margin-bottom: 4px;">🏷️ ${d.farmerName || 'Фермер'}</div>
//           <div>📏 Расстояние: ${distance} км</div>
//           <div>⭐ Рейтинг фермера: ${farmerRating}</div>
//           <div>⭐ Рейтинг продукта: ${productRating}</div>
//           <div>💰 Цена: ${price}</div>
//           <div style="margin-top: 4px; color: ${d.clusterColor}; font-weight: 500;">🔵 Кластер #${d.clusterRank || '?'}</div>
//         `)
//           .style('left', (event.pageX + 15) + 'px')
//           .style('top', (event.pageY - 30) + 'px');
//       })
//       .on('mouseout', function() {
//         d3.select(this).attr('r', 8).attr('opacity', 0.85).attr('stroke', '#fff');
//         tooltip.transition().duration(300).style('opacity', 0);
//       })
//       .on('click', (event, d: any) => {
//         if (onProductSelect) onProductSelect(d);
//       });

//     // Легенда справа
//     const legend = g.append('g')
//       .attr('transform', `translate(${width + 10}, 0)`)
//       .style('pointer-events', 'none');

//     const sortedClusters = [...clusters.clusters].sort((a, b) => (a.rank || 999) - (b.rank || 999));

//     sortedClusters.forEach((cluster: any, i: number) => {
//       if (!cluster) return;
      
//       const legendRow = legend.append('g')
//         .attr('transform', `translate(0, ${i * 65})`);

//       legendRow.append('circle')
//         .attr('cx', 0)
//         .attr('cy', 0)
//         .attr('r', 8)
//         .attr('fill', cluster.rankColor || '#cccccc')
//         .attr('stroke', '#fff')
//         .attr('stroke-width', 1);

//       legendRow.append('text')
//         .attr('x', 15)
//         .attr('y', 4)
//         .style('font-size', '11px')
//         .style('font-weight', 'bold')
//         .text(`Кластер #${cluster.rank || '?'} (${cluster.size || 0})`);

//       const avgDistance = cluster.avgDistance ? cluster.avgDistance.toFixed(1) : '0';
//       const avgFarmerRating = cluster.avgFarmerRating ? cluster.avgFarmerRating.toFixed(1) : '0';
//       const avgProductRating = cluster.avgProductRating ? cluster.avgProductRating.toFixed(1) : '0';

//       legendRow.append('text')
//         .attr('x', 15)
//         .attr('y', 18)
//         .style('font-size', '9px')
//         .style('fill', '#666')
//         .text(`расст: ${avgDistance} км`);

//       legendRow.append('text')
//         .attr('x', 15)
//         .attr('y', 30)
//         .style('font-size', '9px')
//         .style('fill', '#666')
//         .text(`рейтинг ф: ${avgFarmerRating}`);

//       legendRow.append('text')
//         .attr('x', 15)
//         .attr('y', 42)
//         .style('font-size', '9px')
//         .style('fill', '#666')
//         .text(`рейтинг п: ${avgProductRating}`);
//     });

//   }, [clusters, onProductSelect]);

//   if (!clusters || !clusters.clusters || clusters.clusters.length === 0) {
//     return (
//       <Card className="shadow-sm h-100 d-flex align-items-center justify-content-center p-4">
//         <p className="text-muted mb-0">Нет данных для отображения продуктов</p>
//       </Card>
//     );
//   }

//   return (
//     <Card className="shadow-sm h-100">
//       <Card.Header className="bg-light py-2">
//         <h6 className="mb-0">Кластеризация продуктов</h6>
//       </Card.Header>
//       <Card.Body ref={chartRef} className="p-3" style={{ minHeight: '500px', position: 'relative' }} />
//     </Card>
//   );
// };

// export default ProductClusterChart;