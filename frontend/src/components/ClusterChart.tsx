import React, { useRef, useEffect } from 'react';
import { Card } from 'react-bootstrap';
import * as d3 from 'd3';

interface ClusterFarmer {
  id: number;
  name: string;
  rating: number;
  distance: number | null;
  individualScore: number;
  is_subscribed: boolean;
  x: number;
  y: number;
  bestPlaceAddress: string | null;
  placeId: number;
  has_eco_certificate?: boolean;
}

interface RankedCluster {
  id: number;
  rank: number;
  rankScore: number;
  rankColor: string;
  size: number;
  avgDistance: number;
  avgRating: number;
  subscriptionRate: number;
  farmers: ClusterFarmer[];
}

interface ClusterChartProps {
  clusters: {
    clusters: RankedCluster[];
  };
  onFarmerSelect?: (farmer: any) => void;
}

const ClusterChart: React.FC<ClusterChartProps> = ({ clusters, onFarmerSelect }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Очистка предыдущего содержимого
    d3.select(chartRef.current).selectAll('*').remove();

    if (!clusters || !clusters.clusters || clusters.clusters.length === 0) return;

    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const width = 700 - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .style('overflow', 'visible')
      .style('cursor', 'grab');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Сбор всех фермеров (участков) из кластеров
    const allFarmers: any[] = [];
    clusters.clusters.forEach((cluster) => {
      cluster.farmers.forEach((farmer) => {
        allFarmers.push({
          ...farmer,
          clusterRank: cluster.rank,
          clusterColor: cluster.rankColor,
          clusterId: cluster.id,
        });
      });
    });

    const xValues = allFarmers.map((f) => f.x).filter((x): x is number => typeof x === 'number');
    const yValues = allFarmers.map((f) => f.y).filter((y): y is number => typeof y === 'number');
    if (xValues.length === 0 || yValues.length === 0) return;

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xPadding = Math.max((xMax - xMin) * 0.05, 5);
    const yPadding = Math.max((yMax - yMin) * 0.05, 5);

    const xScale = d3.scaleLinear()
      .domain([Math.max(0, xMin - xPadding), Math.min(100, xMax + xPadding)])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([Math.max(0, yMin - yPadding), Math.min(100, yMax + yPadding)])
      .range([height, 0]);

    let currentXScale = xScale.copy();
    let currentYScale = yScale.copy();

    const pointsGroup = g.append('g').attr('class', 'points-group');

    // ========== ТУЛТИП (привязываем к body, чтобы не обрезался) ==========
    const tooltip = d3.select('body')
      .append('div')
      .style('position', 'absolute')
      .style('background', 'white')
      .style('padding', '10px 12px')
      .style('border', '1px solid #ddd')
      .style('border-radius', '8px')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 9999)
      .style('font-size', '12px')
      .style('max-width', '280px')
      .style('line-height', '1.4');

    function updateChart() {
      pointsGroup.selectAll('circle')
        .attr('cx', (d: any) => currentXScale(d.x))
        .attr('cy', (d: any) => currentYScale(d.y));
    }

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .extent([[0, 0], [width + margin.left + margin.right, height + margin.top + margin.bottom]])
      .on('zoom', (event) => {
        currentXScale = event.transform.rescaleX(xScale);
        currentYScale = event.transform.rescaleY(yScale);
        updateChart();
      });

    svg.call(zoom as any);

    // Отрисовка точек
    pointsGroup.selectAll('circle')
      .data(allFarmers)
      .enter()
      .append('circle')
      .attr('cx', (d: any) => currentXScale(d.x))
      .attr('cy', (d: any) => currentYScale(d.y))
      .attr('r', 8)
      .attr('fill', (d: any) => d.clusterColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .attr('opacity', 0.85)
      .on('mouseover', function (event, d: any) {
        d3.select(this).attr('r', 12).attr('opacity', 1).attr('stroke', '#000');
        tooltip.transition().duration(150).style('opacity', 0.95);
        tooltip
          .html(`
            <div style="font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px;">
              ${d.name}
            </div>
            <div>Расстояние: ${d.distance !== null && d.distance !== undefined ? Number(d.distance).toFixed(1) : 'Н/Д'} км</div>
            <div>Рейтинг: ${Number(d.rating || 0).toFixed(1)}</div>
            <div>Score: ${Number(d.individualScore || 0).toFixed(1)}</div>
            ${d.is_subscribed ? '<div style="color: #dc3545;">Есть подписка</div>' : ''}
            ${d.has_eco_certificate ? '<div style="color: #2e7d32;">🌱 Эко-сертификат</div>' : ''}
            <div style="margin-top: 4px; color: ${d.clusterColor}; font-weight: 500;">Кластер #${d.clusterRank}</div>
          `)
          .style('left', `${event.pageX + 15}px`)
          .style('top', `${event.pageY - 30}px`);
      })
      .on('mouseout', function () {
        d3.select(this).attr('r', 8).attr('opacity', 0.85).attr('stroke', '#fff');
        tooltip.transition().duration(150).style('opacity', 0);
      })
      .on('click', (_event, d: any) => {
        if (onFarmerSelect) onFarmerSelect(d);
      });

    // Очистка тултипа при размонтировании компонента
    return () => {
      tooltip.remove();
    };
  }, [clusters, onFarmerSelect]);

  if (!clusters || !clusters.clusters || clusters.clusters.length === 0) {
    return (
      <Card className="shadow-sm h-100 d-flex align-items-center justify-content-center p-4">
        <p className="text-muted mb-0">Нет данных для отображения кластеров</p>
        <small className="text-muted">Укажите адрес доставки и включите расчет расстояния</small>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: '8px' }}>
      {/* Подпись оси Y (слева, вертикально) */}
      <div
        style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: 500,
          color: '#333',
          whiteSpace: 'nowrap',
        }}
      >
        Рейтинг фермера (нормированный)
      </div>

      {/* Карточка с графиком */}
      <div>
        <Card className="shadow-sm h-100">
          <Card.Header className="bg-light py-2 d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Кластеризация участков фермеров</h6>
            {/* <small className="text-muted">🖱️ Колесико - зум, перетаскивание - панорамирование</small> */}
          </Card.Header>
          <Card.Body
            ref={chartRef}
            className="p-3"
            style={{ minHeight: '500px', position: 'relative', overflow: 'hidden' }}
          />
        </Card>
      </div>

      {/* Подпись оси X (снизу, на всю ширину) */}
      <div
        style={{
          gridColumn: '1 / span 2',
          textAlign: 'center',
          marginTop: '8px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#333',
        }}
      >
        Нормированное расстояние
      </div>
    </div>
  );
};

export default ClusterChart;