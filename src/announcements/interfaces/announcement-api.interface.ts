export interface AnnouncementAPI {
    code: string;
    message?: unknown;
    messageDetail?: unknown;
    data: Data;
    success: boolean;
}

export interface Data {
    catalogs: Catalog[];
}

export interface Catalog {
    catalogId: number;
    parentCatalogId?: unknown;
    icon: string;
    catalogName: string;
    description?: unknown;
    catalogType: number;
    total: number;
    articles: Article[];
    catalogs: unknown[];
}

export interface Article {
    id: number;
    code: string;
    title: string;
    type: number;
    releaseDate: number;
}
