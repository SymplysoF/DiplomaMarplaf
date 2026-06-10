// utils/clusterRanking.ts
export interface ClusterMetrics {
  avgScore: number;
  size: number;
  density: number;
  stability: number;
  potential: number;
  totalWeight: number;
}

export interface RankedCluster {
  name: string;
  farmers: any[];
  metrics: ClusterMetrics;
  rank: number;
}

export class MultiFactorClusterRanking {
  // Веса факторов (можно настраивать)
  private weights = {
    avgScore: 0.35,   // Средний скор - 35%
    size: 0.25,       // Размер кластера - 25%
    density: 0.20,    // Плотность/однородность - 20%
    stability: 0.10,  // Стабильность - 10%
    potential: 0.10   // Потенциал (лучший фермер) - 10%
  };

  /**
   * Ранжирование кластеров по мультифакторному методу
   * @param clusters Объект с кластерами { "имя_кластера": [фермеры] }
   * @returns Массив ранжированных кластеров
   */
  rankClusters(clusters: Record<string, any[]>): RankedCluster[] {
    // Получаем все кластеры в виде массива
    const clusterArray = Object.entries(clusters).map(([name, farmers]) => ({
      name,
      farmers,
      ...this.evaluateCluster(farmers, Object.values(clusters))
    }));

    // Сортируем по итоговому весу (от большего к меньшему)
    const sorted = clusterArray.sort((a, b) => b.metrics.totalWeight - a.metrics.totalWeight);

    // Добавляем ранг
    return sorted.map((cluster, index) => ({
      ...cluster,
      rank: index + 1
    }));
  }

  /**
   * Оценка отдельного кластера по всем метрикам
   */
  private evaluateCluster(cluster: any[], allClusters: any[][]) {
    const scores = cluster.map(f => f.totalScore || 0);
    
    // 1. Средний скор
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // 2. Размер (нормализованный относительно максимального кластера)
    const maxSize = Math.max(...allClusters.map(c => c.length));
    const sizeScore = maxSize > 0 ? (cluster.length / maxSize) * 100 : 0;
    
    // 3. Плотность (чем меньше разброс, тем выше плотность)
    const variance = scores.length > 0 
      ? scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length 
      : 0;
    const stdDev = Math.sqrt(variance);
    const densityScore = Math.max(0, 100 - stdDev);
    
    // 4. Стабильность (на основе коэффициента вариации)
    const cv = avgScore > 0 ? stdDev / avgScore : 1;
    const stabilityScore = Math.max(0, 100 - cv * 50);
    
    // 5. Потенциал (максимальный скор в кластере)
    const potentialScore = scores.length > 0 ? Math.max(...scores) : 0;
    
    // Итоговый взвешенный вес кластера
    const totalWeight = 
      avgScore * this.weights.avgScore +
      sizeScore * this.weights.size +
      densityScore * this.weights.density +
      stabilityScore * this.weights.stability +
      potentialScore * this.weights.potential;

    return {
      metrics: {
        avgScore: Math.round(avgScore * 10) / 10,
        size: Math.round(sizeScore),
        density: Math.round(densityScore),
        stability: Math.round(stabilityScore),
        potential: Math.round(potentialScore),
        totalWeight: Math.round(totalWeight * 10) / 10
      }
    };
  }

  /**
   * Получение детального объяснения ранжирования для UI
   */
  getRankingExplanation(cluster: RankedCluster): string[] {
    const explanations = [
      `📊 Средний скор: ${cluster.metrics.avgScore}% (вес 35%)`,
      `📈 Размер кластера: ${cluster.metrics.size}% от максимального (вес 25%)`,
      `🎯 Плотность: ${cluster.metrics.density}% (вес 20%) - ${this.getDensityDescription(cluster.metrics.density)}`,
      `⚖️ Стабильность: ${cluster.metrics.stability}% (вес 10%)`,
      `🚀 Потенциал: ${cluster.metrics.potential}% (вес 10%)`,
      `🏆 ИТОГОВЫЙ ВЕС: ${cluster.metrics.totalWeight}%`,
      `📌 Ранг: ${cluster.rank} из ${cluster.rank}`
    ];
    return explanations;
  }

  private getDensityDescription(density: number): string {
    if (density >= 80) return 'очень однородный кластер';
    if (density >= 60) return 'умеренно однородный';
    if (density >= 40) return 'средняя однородность';
    return 'разнородный кластер';
  }

  /**
   * Ранжирование фермеров внутри кластера
   */
  rankFarmersInCluster(farmers: any[]): any[] {
    return [...farmers].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  }
}