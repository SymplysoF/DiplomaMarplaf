

export interface FarmerDetails extends Farmer {
  user_id: number;
  farmer_login: string;
}

export interface CategoryGroup {
  categoryId: number;
  categoryName: string;
  products: Product[];
  productCount: number;
  totalItems: number;
  icon?: React.ReactNode;
}

export interface MapPointProperties {
  id: number;
  farmerId: number;
  farmerName: string;
  address: string;
  kadastrNumber: string;
  area: number;
  productsCount: number;
  uniqueProducts: number;
  categoriesCount: number;
  color: string;
  rating?: number;
  isFavorite: boolean;
  categoryIds: number[]; // Добавляем для фильтрации
}


// types/map.types.ts
export interface Product {
  id: number;
  name: string;
  categoryId?: number;
  categoryName?: string;
  objectName?: string;
  varietyName?: string;
  quantity?: number;
  freshnessId?: number;
  freshnessName?: string;
}

export interface Place {
  id: number;
  address: string;
  kadastrNumber: string;
  area: number;
  boundaries?: any;
  products: Product[];
  farmerId?: number;
  farmerName?: string;
  farmerRating?: number;
}

export interface Farmer {
  id: number;
  name: string;
  rating?: number;
  places: Place[];
  description?: string;
  contactphone?: string;
  contactemail?: string;
  contactaddress?: string;
  createdAt?: string;
}

export interface FarmerWithScore extends Farmer {
  distance_km?: number;
  avgRipeness?: number;
  totalScore?: number;
  categoriesCount?: number;
  totalProducts?: number;
  freshnessScores?: number[];
}

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
  farmers: FarmerWithScore[];
  metrics: ClusterMetrics;
  rank: number;
}